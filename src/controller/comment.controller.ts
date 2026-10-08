import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { Types } from "mongoose";
import { addComment, deleteComment, getProductComment } from "../service/comment.service";
import MarketplaceOrder from "../model/marketplace-order.model";
import Command from "../model/command.model";
import Comment from "../model/comment.model";
import { hasAdminPermission } from "../service/admin-permissions.service";
import { findComment, getCommentsForModeration, moderateComment } from "../service/comment.service";
import { getProductById } from "../service/product.service";
import { recordAdminAction } from "../service/admin-audit.service";

const isSuperAdmin = (user: any) =>
    hasAdminPermission(user, "moderation.review");

const addNewComment = expressAsyncHandler(async(req: Request, res: Response)=>{
    const user = (req as any).user;
    const data = req.body;
    if(!user){
        res.status(401).json({status:"Failed", message:"Authentification requise."});
        return;
    }

    const product = await getProductById(String(data.product_id ?? ""));
    if (!product || product.publicationStatus !== "Approved") {
        res.status(404).json({status:"Failed", message:"Ce produit n’est pas disponible pour les commentaires."});
        return;
    }

    const productId = String(data.product_id ?? "");
    const marketplacePurchase = await MarketplaceOrder.exists({ owner_id: user._id, subOrders: { $elemMatch: { status: "terminee", items: { $elemMatch: { product_id: productId } } } } });
    const legacyPurchase = await Command.exists({ owner_id: user._id, product_id: productId, status: "Accepted" });
    if (!marketplacePurchase && !legacyPurchase) {
        res.status(403).json({ status: "Failed", message: "Seuls les clients ayant reçu leur commande peuvent publier un avis vérifié." });
        return;
    }
    const existingReview = await Comment.exists({ owner_id: user._id, product_id: productId });
    if (existingReview) {
        res.status(409).json({ status: "Failed", message: "Vous avez déjà publié un avis pour ce produit." });
        return;
    }
    const commentText = String(data.comment ?? "").trim();
    if (commentText.length < 3 || commentText.length > 2000) {
        res.status(400).json({ status: "Failed", message: "Un avis doit contenir entre 3 et 2 000 caractères." });
        return;
    }

    try {
        const newData = {
            comment: commentText,
            product_id: String(data.product_id),
            owner_id: user._id,
            moderationStatus: "Pending" as const,
            moderationReason: "",
            verifiedPurchase: true,
        };
        const comment = await addComment(newData);

        if(!comment){
            res.status(400).json({status:"Failed", message:"Impossible d’ajouter le commentaire."});
            return;
        }

        res.status(201).json({status:"Success", message:"Votre commentaire a été envoyé pour approbation.", data: comment});
    } catch (error) {
        throw error
    }
})


const removeComment = expressAsyncHandler(async(req: Request, res:Response)=>{
    const user = (req as any).user;
    const {id} = req.params;
    if(!user){
        res.status(401).json({status:"Failed", message:"Authentification requise."});
        return;
    }

    const existingComment = await findComment(id);
    if (!existingComment) {
        res.status(404).json({status:"Failed", message:"Commentaire introuvable."});
        return;
    }
    if (String(existingComment.owner_id) !== String(user._id) && !isSuperAdmin(user)) {
        res.status(403).json({status:"Failed", message:"Vous ne pouvez pas supprimer ce commentaire."});
        return;
    }

    try {
        const comment = await deleteComment(id);
        if(!comment){
            res.status(400).json({status:"Failed", message:"Impossible de supprimer le commentaire."});
            return;
        }

        res.status(201).json({status:"Success", message:"Le commentaire a été supprimé.", data: comment});
    } catch (error) {
        throw error;
    }

   
});

const getComment = expressAsyncHandler(async(req: Request, res:Response)=>{
    const {id} = req.params;
    const comment = await getProductComment(id);
    if(!comment){
        res.status(400).json({status:"Failed", message:"Commentaire introuvable."});
        return;
    }
    res.status(200).json({status:"Success", data: comment});
})

const listCommentsForModeration = expressAsyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!isSuperAdmin(user)) {
        res.status(403).json({status:"Failed", message:"Accès réservé au Super Admin."});
        return;
    }
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "25"), 10) || 25));
    const [data, total] = await Promise.all([getCommentsForModeration(page, limit), Comment.countDocuments({})]);
    res.status(200).json({status:"Success", data, pagination: { page, limit, total, pages: Math.ceil(total / limit) }});
});

const moderateCommentStatus = expressAsyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!isSuperAdmin(user)) {
        res.status(403).json({status:"Failed", message:"Accès réservé au Super Admin."});
        return;
    }
    const { moderationStatus, moderationReason } = req.body;
    if (!["Approved", "Rejected"].includes(moderationStatus)) {
        res.status(400).json({status:"Failed", message:"Décision de modération invalide."});
        return;
    }
    const reason = typeof moderationReason === "string" ? moderationReason.trim().slice(0, 500) : "";
    if (moderationStatus === "Rejected" && !reason) {
        res.status(400).json({status:"Failed", message:"Un motif est requis pour refuser un commentaire."});
        return;
    }
    const comment = await moderateComment(req.params.id, moderationStatus, reason, String(user._id));
    if (!comment) {
        res.status(404).json({status:"Failed", message:"Commentaire introuvable."});
        return;
    }
    res.status(200).json({status:"Success", message: moderationStatus === "Approved" ? "Commentaire approuvé." : "Commentaire refusé."});
});

const moderateCommentsInBulk = expressAsyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!isSuperAdmin(user)) {
        res.status(403).json({status:"Failed", message:"Permission de modération insuffisante."});
        return;
    }
    const ids: unknown = req.body?.ids;
    const moderationStatus = req.body?.moderationStatus;
    const reason = typeof req.body?.moderationReason === "string" ? req.body.moderationReason.trim().slice(0, 500) : "";
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || ids.some((id) => typeof id !== "string" || !Types.ObjectId.isValid(id)) || new Set(ids).size !== ids.length || !["Approved", "Rejected"].includes(moderationStatus) || (moderationStatus === "Rejected" && !reason)) {
        res.status(400).json({status:"Failed", message:"Sélection, décision ou motif de modération invalide."});
        return;
    }
    const comments = await Comment.find({ _id: { $in: ids } }).select("_id comment").lean();
    if (comments.length !== ids.length) {
        res.status(409).json({status:"Failed", message:"La sélection a changé. Rechargez la file avant de réessayer."});
        return;
    }
    const result = await Comment.updateMany(
        { _id: { $in: ids } },
        { $set: { moderationStatus, moderationReason: reason, moderatedBy: user._id, moderatedAt: new Date() } },
        { runValidators: true },
    );
    if (result.matchedCount !== ids.length) {
        res.status(409).json({status:"Failed", message:"Tous les commentaires n’ont pas pu être mis à jour. Rechargez la file et vérifiez chaque décision."});
        return;
    }
    await Promise.all(comments.map((comment) => recordAdminAction({
        actorId: String(user._id),
        actorName: user.username ?? "Administrateur",
        action: `moderation.comment.${String(moderationStatus).toLowerCase()}`,
        targetType: "comment",
        targetId: String(comment._id),
        targetLabel: comment.comment.slice(0, 80),
        reason,
    })));
    res.status(200).json({status:"Success", message:`${comments.length} avis traité(s).`, data:{updated:comments.length}});
});


export {getComment, removeComment, addNewComment, listCommentsForModeration, moderateCommentStatus, moderateCommentsInBulk};
