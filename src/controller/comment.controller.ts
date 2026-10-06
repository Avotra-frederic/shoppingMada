import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { addComment, deleteComment, getProductComment } from "../service/comment.service";
import { findComment, getCommentsForModeration, moderateComment } from "../service/comment.service";
import { getProductById } from "../service/product.service";

const isSuperAdmin = (user: any) =>
    user?.userGroupMember_id?.usergroup_id?.name === "Super Admin";

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

    try {
        const newData = {
            comment: String(data.comment ?? "").trim(),
            product_id: String(data.product_id),
            owner_id: user._id,
            moderationStatus: "Pending" as const,
            moderationReason: "",
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
    res.status(200).json({status:"Success", data: await getCommentsForModeration()});
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


export {getComment, removeComment, addNewComment, listCommentsForModeration, moderateCommentStatus};