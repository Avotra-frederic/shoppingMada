import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { Types } from "mongoose";
import IProduct from "../interface/product.interface";
import {
  create_product,
  getAllProductInCategory,
  getAllProduct,
  getProductById,
  addProductVariant,
  getBoutiksProduct,
  listBoutiksProducts,
  deleteProduct,
  deleteVariant,
  updateVariant,
  updateProduct,
  searchProduct,
  getProductsForModeration,
  listPublicProducts,
  moderateProduct,
  submitProductForReview,
} from "../service/product.service";
import path from "path";
import fs from "fs";
import { findBoutiks } from "../service/boutiks.service";
import { deleteProductCommand } from "../service/command.service";
import xss from "xss";
import { get_user_group_name } from "../service/user_group_member.service";
import { recordAdminAction } from "../service/admin-audit.service";
import SubscriptionPlan from "../model/subscription-plan.model";
import Product from "../model/product.model";
import { hasAdminPermission } from "../service/admin-permissions.service";

const storeProduct = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const data = { ...req.body, details: xss(String(req.body.details ?? "")) };
    const fileNames: string[] = (req as any).fileNames ?? [];
    const currentUser = (req as any).user;
    const role = await get_user_group_name({ user_id: currentUser._id });
    if (role !== "Boutiks" && role !== "Super Admin") {
      res.status(403).json({ status: "Failed", message: "Seuls les vendeurs peuvent gérer les produits." });
      return;
    }
    const boutiks = await findBoutiks(currentUser._id);
    if (role === "Boutiks" && !boutiks) {
      res.status(409).json({ status: "Failed", message: "Aucune boutique n'est liée à ce compte." });
      return;
    }
    if (req.method === "POST") {
      if (role === "Boutiks" && boutiks) {
        const subscription = boutiks.subscription_id as any;
        const withinGrace = subscription?.lifecycleStatus === "grace" && subscription.graceUntil && new Date(subscription.graceUntil).getTime() > Date.now();
        const planKey = subscription?.payementStatus === "Completed" && ((subscription.endDate && new Date(subscription.endDate).getTime() > Date.now()) || withinGrace) ? "pro" : "free";
        const plan: any = await SubscriptionPlan.findOne({ key: planKey, active: true }).lean();
        if (plan && Number(plan.maxProducts) > 0) {
          const count = await Product.countDocuments({ boutiks_id: boutiks._id });
          if (count >= Number(plan.maxProducts)) {
            res.status(403).json({ status: "Failed", code: "PLAN_QUOTA_REACHED", message: `La limite de ${plan.maxProducts} produits du forfait ${plan.name} est atteinte.`, quota: plan.maxProducts, used: count });
            return;
          }
        }
      }
      const newData = {
        name: String(data.name ?? "").trim(),
        description: String(data.description ?? "").trim(),
        details: xss(String(data.details ?? "")),
        price: Number(data.price),
        stock: Number(data.stock),
        category: String(data.category ?? ""),
        variant: Array.isArray(data.variant) ? data.variant : [],
        owner_id: (req as any).user._id,
        photos: fileNames,
        boutiks_id: boutiks?._id,
        publicationStatus: "Pending",
        moderationReason: "",
      };
      const product = await create_product(newData as IProduct);
      if (!product) {
        res.status(400).json({
          status: "Failed",
          message: "Impossible d’enregistrer le produit. Veuillez réessayer.",
        });
        return;
      }
    }

    if (req.method === "PUT") {
      const { id } = req.params;
      const { photos } = data;
      let retainedPhotos: string[] = [];
      try {
        retainedPhotos = typeof photos === "string" ? JSON.parse(photos) : Array.isArray(photos) ? photos : [];
      } catch {
        retainedPhotos = [];
      }
      const newData = {
        name: String(data.name ?? "").trim(),
        description: String(data.description ?? "").trim(),
        details: xss(String(data.details ?? "")),
        price: Number(data.price),
        stock: Number(data.stock),
        category: String(data.category ?? ""),
        photos: [...retainedPhotos, ...fileNames].slice(0, 5),
        publicationStatus: "Pending",
        moderationReason: "",
      };
      const existingProduct = await getProductById(id);
      if (!existingProduct || String(existingProduct.owner_id) !== String((req as any).user._id)) {
        res.status(existingProduct ? 403 : 404).json({ status: "Failed", message: "Produit introuvable ou accès refusé" });
        return;
      }
      const product = await updateProduct(id, newData as IProduct);
      if (!product) {
        res
          .status(400)
          .json({
            status: "Failed",
            message: "Impossible de mettre à jour le produit. Veuillez réessayer.",
          });
        return;
      }
    }

    res
      .status(req.method === "POST" ? 201 : 200)
      .json({ status: "Success", message: "Produit enregistré et envoyé pour approbation." });
  },
);

const getProduct = expressAsyncHandler(async (req: Request, res: Response) => {
  const category = req.params.category ?? (typeof req.query.category === "string" ? req.query.category.trim().slice(0, 100) : undefined);
  const { id } = req.params;

  const user = (req as any).user;

  if (user && !id) {
    if (req.query.page !== undefined || req.query.limit !== undefined || req.query.search !== undefined || req.query.status !== undefined) {
      const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20));
      const status = typeof req.query.status === "string" ? req.query.status : "all";
      if (!(status === "all" || ["Pending", "Approved", "Rejected"].includes(status))) {
        res.status(400).json({ status: "Failed", message: "Filtre de publication invalide." });
        return;
      }
      const result = await listBoutiksProducts(String(user._id), { page, limit, status, q: typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : undefined });
      res.status(200).json({ status: "Success", ...result });
      return;
    }
    const product = await getBoutiksProduct(user._id);
    res.status(200).json({ status: "Success", data: product });
    return;
  }
  if (id) {
    const product = await getProductById(id);
    if (!product) {
      res.status(404).json({ status: "Failed", message: "Produit introuvable." });
      return;
    }
    const isOwner = user && String(product.owner_id) === String(user._id);
    const isAdmin = user?.userGroupMember_id?.usergroup_id?.name === "Super Admin";
    const shopActive = (product.boutiks_id as any)?.isActive !== false;
    if ((product.publicationStatus !== "Approved" || !shopActive) && !isOwner && !isAdmin) {
      res.status(404).json({ status: "Failed", message: "Produit introuvable." });
      return;
    }
    res.status(200).json({ status: "Success", data: product });
    return;
  }

  if (category) {
    if (req.query.page !== undefined || req.query.limit !== undefined) {
      const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "24"), 10) || 24));
      const minPrice = req.query.minPrice === undefined ? undefined : Number(req.query.minPrice);
      const maxPrice = req.query.maxPrice === undefined ? undefined : Number(req.query.maxPrice);
      if ((minPrice !== undefined && (!Number.isFinite(minPrice) || minPrice < 0)) || (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0)) || (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)) {
        res.status(400).json({ status: "Failed", message: "La fourchette de prix est invalide." }); return;
      }
      const result = await listPublicProducts({ page, limit, category, q: typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : undefined, location: typeof req.query.location === "string" ? req.query.location.trim().slice(0, 100) : undefined, sort: typeof req.query.sort === "string" ? req.query.sort : undefined, minPrice, maxPrice });
      res.status(200).json({ status: "Success", ...result }); return;
    }
    const product = await getAllProductInCategory(category);
    res.status(200).json({ status: "Success", data: product });
    return;
  }

  if (req.query.page !== undefined || req.query.limit !== undefined) {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "24"), 10) || 24));
    const minPrice = req.query.minPrice === undefined ? undefined : Number(req.query.minPrice);
    const maxPrice = req.query.maxPrice === undefined ? undefined : Number(req.query.maxPrice);
    if ((minPrice !== undefined && (!Number.isFinite(minPrice) || minPrice < 0)) || (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0)) || (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)) {
      res.status(400).json({ status: "Failed", message: "La fourchette de prix est invalide." }); return;
    }
    const result = await listPublicProducts({ page, limit, q: typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : undefined, location: typeof req.query.location === "string" ? req.query.location.trim().slice(0, 100) : undefined, sort: typeof req.query.sort === "string" ? req.query.sort : undefined, minPrice, maxPrice });
    res.status(200).json({ status: "Success", ...result }); return;
  }
  const product = await getAllProduct();
  res.status(200).json({ status: "Success", data: product });
});

const listProductsForModeration = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!hasAdminPermission(user, "moderation.review")) {
    res.status(403).json({ status: "Failed", message: "Accès réservé au Super Admin." });
    return;
  }
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "25"), 10) || 25));
  res.status(200).json({ status: "Success", ...await getProductsForModeration(page, limit) });
});

const moderateProductPublication = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!hasAdminPermission(user, "moderation.review")) {
    res.status(403).json({ status: "Failed", message: "Accès réservé au Super Admin." });
    return;
  }
  const { publicationStatus, moderationReason } = req.body;
  if (!["Approved", "Rejected"].includes(publicationStatus)) {
    res.status(400).json({ status: "Failed", message: "Décision de modération invalide." });
    return;
  }
  const reason = typeof moderationReason === "string" ? moderationReason.trim().slice(0, 500) : "";
  if (publicationStatus === "Rejected" && !reason) {
    res.status(400).json({ status: "Failed", message: "Un motif est requis pour refuser une publication." });
    return;
  }
  const product = await moderateProduct(req.params.id, publicationStatus, reason, String(user._id));
  if (!product) {
    res.status(404).json({ status: "Failed", message: "Produit introuvable." });
    return;
  }
  await recordAdminAction({ actorId: String(user._id), actorName: user.username ?? "Super Admin", action: `moderation.product.${publicationStatus.toLowerCase()}`, targetType: "product", targetId: String((product as any)._id), targetLabel: String((product as any).name ?? ""), reason, ip: req.ip });
  res.status(200).json({ status: "Success", message: publicationStatus === "Approved" ? "Produit approuvé et publié." : "Produit refusé.", data: product });
});

const moderateProductsInBulk = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!hasAdminPermission(user, "moderation.review")) {
    res.status(403).json({ status: "Failed", message: "Permission de modération insuffisante." });
    return;
  }
  const ids: unknown = req.body?.ids;
  const publicationStatus = req.body?.publicationStatus;
  const reason = typeof req.body?.moderationReason === "string" ? req.body.moderationReason.trim().slice(0, 500) : "";
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || ids.some((id) => typeof id !== "string" || !Types.ObjectId.isValid(id)) || new Set(ids).size !== ids.length || !["Approved", "Rejected"].includes(publicationStatus) || (publicationStatus === "Rejected" && !reason)) {
    res.status(400).json({ status: "Failed", message: "Sélection, décision ou motif de modération invalide." });
    return;
  }
  const products = await Product.find({ _id: { $in: ids } }).select("_id name").lean();
  if (products.length !== ids.length) {
    res.status(409).json({ status: "Failed", message: "La sélection a changé. Rechargez la file avant de réessayer." });
    return;
  }
  const result = await Product.updateMany(
    { _id: { $in: ids } },
    { $set: { publicationStatus, moderationReason: reason, moderatedBy: user._id, moderatedAt: new Date() } },
    { runValidators: true },
  );
  if (result.matchedCount !== ids.length) {
    res.status(409).json({ status: "Failed", message: "Tous les produits n’ont pas pu être mis à jour. Rechargez la file et vérifiez chaque décision." });
    return;
  }
  await Promise.all(products.map((product) => recordAdminAction({
    actorId: String(user._id),
    actorName: user.username ?? "Administrateur",
    action: `moderation.product.${String(publicationStatus).toLowerCase()}`,
    targetType: "product",
    targetId: String(product._id),
    targetLabel: product.name,
    reason,
    ip: req.ip,
  })));
  res.status(200).json({ status: "Success", message: `${products.length} produit(s) traité(s).`, data: { updated: products.length } });
});

const addNewVariant = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      res.status(401).json({ status: "Failed", message: "Authentification requise." });
      return;
    }
    const existingProduct = await getProductById(id);
    if (!existingProduct || String(existingProduct.owner_id) !== String((req as any).user._id)) {
      res.status(existingProduct ? 403 : 404).json({ status: "Failed", message: "Produit introuvable ou accès refusé" });
      return;
    }
    const data = req.body;
    const variant = await addProductVariant(id, data);
    if (!variant) {
      res.status(400).json({
        status: "Failed",
        message: "Une erreur est survenue. Veuillez réessayer.",
      });
      return;
    }
    await submitProductForReview(id);

    res.status(201).json({
      status: "Success",
      message: "La variante du produit a été ajoutée.",
    });
  },
);

const deleteBoutiksProduct = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ status: "Failed", message: "Authentification requise." });
      return;
    }
    const existingProduct = await getProductById(id);
    if (!existingProduct || String(existingProduct.owner_id) !== String(user._id)) {
      res.status(existingProduct ? 403 : 404).json({ status: "Failed", message: "Produit introuvable ou accès refusé" });
      return;
    }
    const newProduct = await deleteProduct(id);
    if (!newProduct) {
      res.status(400).json({
        status: "Failed",
        message: "Une erreur est survenue. Veuillez réessayer.",
      });
      return;
    }
    newProduct.photos.forEach((photo: string, index: number) => {
      const imagePath = path.join(
        __dirname,
        "../..",
        "public",
        "uploads",
        newProduct.photos[index],
      );
      fs.unlink(imagePath, (err) => {
        if (err) {
        }
      });
    });

    await deleteProductCommand(id);

    res.status(201).json({
      status: "Success",
      message: "Le produit a été supprimé.",
      data: newProduct,
    });
  },
);

const removeVariant = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id, variant_id, valueName } = req.params;
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ status: "Failed", message: "Authentification requise." });
      return;
    }
    const existingProduct = await getProductById(id);
    if (!existingProduct || String(existingProduct.owner_id) !== String(user._id)) {
      res.status(existingProduct ? 403 : 404).json({ status: "Failed", message: "Produit introuvable ou accès refusé" });
      return;
    }
    const product = await deleteVariant(id, variant_id, valueName);
    if (!product) {
      res.status(400).json({
        status: "Failed",
        message: "Une erreur est survenue. Veuillez réessayer.",
      });
      return;
    }
    await submitProductForReview(id);

    res.status(201).json({
      status: "Success",
      message: "La variante du produit a été supprimée.",
      data: product,
    });
  },
);

const updateProductVariant = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id, variant_id } = req.params;
    const data = req.body;
    const existingProduct = await getProductById(id);
    if (!existingProduct || String(existingProduct.owner_id) !== String((req as any).user._id)) {
      res.status(existingProduct ? 403 : 404).json({ status: "Failed", message: "Produit introuvable ou accès refusé" });
      return;
    }
    const variant = await updateVariant(id, variant_id, data);
    if (!variant) {
      res.status(400).json({
        status: "Failed",
        message: "Une erreur est survenue. Veuillez réessayer.",
      });
      return;
    }
    await submitProductForReview(id);

    res.status(201).json({
      status: "Success",
      message: "La variante du produit a été mise à jour.",
    });
  },
);

const search_product = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { q,location } = req.query;
    if (typeof q !== "string" || !q.trim() || q.length > 100 || (typeof location === "string" && location.length > 100)) {
      res.status(400).json({ status: "Failed", message: "Le terme de recherche est requis" });
      return;
    }
    try {
      if (req.query.page !== undefined || req.query.limit !== undefined) {
        const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "24"), 10) || 24));
        const minPrice = req.query.minPrice === undefined ? undefined : Number(req.query.minPrice);
        const maxPrice = req.query.maxPrice === undefined ? undefined : Number(req.query.maxPrice);
        if ((minPrice !== undefined && (!Number.isFinite(minPrice) || minPrice < 0)) || (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0)) || (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)) {
          res.status(400).json({ status: "Failed", message: "La fourchette de prix est invalide." }); return;
        }
        const result = await listPublicProducts({ page, limit, q: q.trim(), location: typeof location === "string" ? location.trim() : undefined, sort: typeof req.query.sort === "string" ? req.query.sort : undefined, minPrice, maxPrice });
        res.status(200).json(result); return;
      }
      let product ;
      if(!location){
        product =  await searchProduct(q as string);
      }
      if(location){
        product =  await searchProduct(q as string, location as string);
      }
      if (!product) {
        res.status(404).json({ status: "Failed", message: "Aucun produit trouvé." });
        return;
      }

      res.status(200).json({ data: product });
    } catch (error) {
      throw error;
    }
  },
);

const toggleWishlist = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?._id) { res.status(401).json({ status: "Failed", message: "Connectez-vous pour gérer vos favoris." }); return; }
  const productId = req.params.id;
  if (!/^[a-f\d]{24}$/i.test(productId)) { res.status(400).json({ status: "Failed", message: "Produit invalide." }); return; }
  const exists = await Product.exists({ _id: productId, publicationStatus: "Approved" });
  if (!exists) { res.status(404).json({ status: "Failed", message: "Produit indisponible." }); return; }
  const current = await Product.findById(productId).select("wishlistedBy").lean<any>();
  const isSaved = (current?.wishlistedBy ?? []).some((id: any) => String(id) === String(user._id));
  await Product.updateOne({ _id: productId }, isSaved ? { $pull: { wishlistedBy: user._id } } : { $addToSet: { wishlistedBy: user._id } });
  res.status(200).json({ status: "Success", data: { saved: !isSaved } });
});

const listWishlist = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user; const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1); const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20));
  const filter = { wishlistedBy: user._id, publicationStatus: "Approved" };
  const [data, total] = await Promise.all([Product.find(filter).populate("boutiks_id").sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Product.countDocuments(filter)]);
  res.status(200).json({ status: "Success", data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export {
  storeProduct,
  getProduct,
  listProductsForModeration,
  toggleWishlist,
  listWishlist,
  moderateProductPublication,
  moderateProductsInBulk,
  addNewVariant,
  deleteBoutiksProduct,
  removeVariant,
  updateProductVariant,
  search_product,
};
