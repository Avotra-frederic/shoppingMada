import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import IProduct from "../interface/product.interface";
import {
  create_product,
  getAllProductInCategory,
  getAllProduct,
  getProductById,
  addProductVariant,
  getBoutiksProduct,
  deleteProduct,
  deleteVariant,
  updateVariant,
  updateProduct,
  searchProduct,
  getProductsForModeration,
  moderateProduct,
  submitProductForReview,
} from "../service/product.service";
import path from "path";
import fs from "fs";
import { findBoutiks } from "../service/boutiks.service";
import { deleteProductCommand } from "../service/command.service";
import xss from "xss";
import { get_user_group_name } from "../service/user_group_member.service";

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
  const { category, id } = req.params;

  const user = (req as any).user;

  if (user && !id) {
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
    const product = await getAllProductInCategory(category);
    res.status(200).json({ status: "Success", data: product });
    return;
  }

  const product = await getAllProduct();
  res.status(200).json({ status: "Success", data: product });
});

const listProductsForModeration = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user?.userGroupMember_id?.usergroup_id?.name !== "Super Admin") {
    res.status(403).json({ status: "Failed", message: "Accès réservé au Super Admin." });
    return;
  }
  res.status(200).json({ status: "Success", data: await getProductsForModeration() });
});

const moderateProductPublication = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user?.userGroupMember_id?.usergroup_id?.name !== "Super Admin") {
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
  res.status(200).json({ status: "Success", message: publicationStatus === "Approved" ? "Produit approuvé et publié." : "Produit refusé.", data: product });
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

export {
  storeProduct,
  getProduct,
  listProductsForModeration,
  moderateProductPublication,
  addNewVariant,
  deleteBoutiksProduct,
  removeVariant,
  updateProductVariant,
  search_product,
};
