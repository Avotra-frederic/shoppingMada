import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { get_user_group_name } from "../service/user_group_member.service";
import { findBoutiks } from "../service/boutiks.service";
import {
  addCommande,
  deleteCommande,
  getBoutiksCommand,
  listBoutiksCommand,
  getClientCommand,
  getCommandeById,
  updateStatus,
} from "../service/command.service";
import ICommand from "../interface/command.interface";
import { getProductById } from "../service/product.service";
import sendEmail from "../helpers/mail";

const canAccessCommand = async (user: any, command: any) => {
  const role = await get_user_group_name({ user_id: user._id });
  const isClientOwner = String((command.owner_id as any)?._id ?? command.owner_id) === String(user._id);
  const shopId = command.boutiks_id?._id ?? command.boutiks_id;
  const isShopOwner = user.boutiks_id && String(shopId) === String(user.boutiks_id._id ?? user.boutiks_id);
  return { role, allowed: isClientOwner || (role === "Boutiks" && isShopOwner) };
};

const getAllCommand = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;
  if (id) {
    const command = await getCommandeById(id);
    if (!command) {
      res.status(404).json({ status: "Failed", message: "Commande introuvable." });
      return;
    }
    const { allowed } = await canAccessCommand(user, command);
    if (!allowed) {
      res.status(403).json({ status: "Failed", message: "Accès refusé." });
      return;
    }
    res.status(200).json({ status: "Success", data: command });
    return;
  }

  const role = await get_user_group_name({ user_id: user._id });
  if (role === "Boutiks") {
    const shop = await findBoutiks(user._id);
    if (req.query.page !== undefined || req.query.limit !== undefined || req.query.status !== undefined) {
      const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20));
      const status = typeof req.query.status === "string" ? req.query.status : "all";
      if (!shop || !(status === "all" || ["Pending", "Accepted", "Rejected", "Canceled"].includes(status))) {
        res.status(shop ? 400 : 404).json({ status: "Failed", message: shop ? "Filtre de statut invalide." : "Boutique introuvable." });
        return;
      }
      res.status(200).json({ status: "Success", ...(await listBoutiksCommand(String(shop._id), { page, limit, status })) });
      return;
    }
    res.status(200).json({ status: "Success", data: shop ? await getBoutiksCommand(String(shop._id)) ?? [] : [] });
    return;
  }
  if (role === "Client") {
    res.status(200).json({ status: "Success", data: await getClientCommand(String(user._id)) ?? [] });
    return;
  }
  res.status(403).json({ status: "Failed", message: "Accès refusé." });
});

const addNewCommande = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { product_id, quantity, variants = {} } = req.body;
  if (!product_id || !Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 100) {
    res.status(400).json({ status: "Failed", message: "Produit ou quantité invalide." });
    return;
  }
  const role = await get_user_group_name({ user_id: user._id });
  if (role !== "Client") {
    res.status(403).json({ status: "Failed", message: "Seuls les clients peuvent commander." });
    return;
  }
  const product = await getProductById(String(product_id));
  if (!product || String(product.owner_id) === String(user._id)) {
    res.status(404).json({ status: "Failed", message: "Produit introuvable." });
    return;
  }
  if (product.stock !== undefined && product.stock < Number(quantity)) {
    res.status(409).json({ status: "Failed", message: "Stock insuffisant." });
    return;
  }

  let unitPrice = Number(product.price);
  if (!variants || typeof variants !== "object" || Array.isArray(variants)) {
    res.status(400).json({ status: "Failed", message: "Les options du produit sont invalides." });
    return;
  }
  for (const [variantName, selectedValue] of Object.entries(variants as Record<string, string>)) {
    const variant = product.variant?.find((item: any) => item.name === variantName);
    const value = variant?.values?.find((item) => item.value === selectedValue);
    if (!value) {
      res.status(400).json({ status: "Failed", message: `Variante invalide : ${variantName}` });
      return;
    }
    unitPrice += Number(value.additionalPrice ?? 0);
  }

  const shopId = (product.boutiks_id as any)?._id ?? product.boutiks_id;
  if (!shopId) {
    res.status(409).json({ status: "Failed", message: "Le produit n'est rattaché à aucune boutique." });
    return;
  }
  const newCommand = await addCommande({
    product_id, quantity: Number(quantity), variants, owner_id: user._id,
    boutiks_id: shopId, total: unitPrice * Number(quantity), status: "Pending",
  } as ICommand);
  if (!newCommand) {
    res.status(400).json({ status: "Failed", message: "Impossible de créer la commande." });
    return;
  }
  const shop = product.boutiks_id as any;
  if (shop.email) {
    await sendEmail({
      title: "Nouvelle commande",
      message: `Vous avez reçu une commande de ${user.email}.`,
      information: "Une nouvelle commande est disponible dans votre espace vendeur.",
      content: "Connectez-vous à ShoppingMada pour la consulter.",
    }, shop.email, "Nouvelle commande");
  }
  res.status(201).json({ status: "Success", message: "Commande créée.", data: newCommand });
});

const updateCommande = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;
  const command = await getCommandeById(id);
  if (!command) {
    res.status(404).json({ status: "Failed", message: "Commande introuvable." });
    return;
  }
  const { role, allowed } = await canAccessCommand(user, command);
  if (!allowed || command.status !== "Pending") {
    res.status(403).json({ status: "Failed", message: "Cette commande ne peut pas être modifiée." });
    return;
  }
  const { status, motif } = req.body;
  const owner = String((command.owner_id as any)?._id ?? command.owner_id) === String(user._id);
  const validTransition = owner ? status === "Canceled" : role === "Boutiks" && ["Accepted", "Rejected"].includes(status);
  if (!validTransition) {
    res.status(400).json({ status: "Failed", message: "Transition de statut invalide." });
    return;
  }
  if (status === "Rejected" && (typeof motif !== "string" || !motif.trim())) {
    res.status(400).json({ status: "Failed", message: "Le motif de refus est requis." });
    return;
  }
  const updated = await updateStatus(id, status);
  if (!updated) {
    res.status(400).json({ status: "Failed", message: "Impossible de mettre à jour la commande." });
    return;
  }
  const client = command.owner_id as any;
  if (client.email && status !== "Canceled") {
    await sendEmail({
      title: "Mise à jour de votre commande",
      message: status === "Accepted" ? "Votre commande a été acceptée." : "Votre commande a été refusée.",
      information: status === "Rejected" ? `Motif : ${motif.trim()}` : "",
      content: "Connectez-vous à ShoppingMada pour consulter les détails.",
    }, client.email, "Mise à jour de votre commande");
  }
  res.status(200).json({ status: "Success", message: "Commande mise à jour.", data: updated });
});

const removeCommand = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const command = await getCommandeById(req.params.id);
  if (!command) {
    res.status(404).json({ status: "Failed", message: "Commande introuvable." });
    return;
  }
  const { role, allowed } = await canAccessCommand(user, command);
  const isOwner = String((command.owner_id as any)?._id ?? command.owner_id) === String(user._id);
  if (!allowed || role !== "Client" || !isOwner || command.status !== "Pending") {
    res.status(403).json({ status: "Failed", message: "Cette commande ne peut pas être supprimée." });
    return;
  }
  const deleted = await deleteCommande(req.params.id);
  res.status(200).json({ status: "Success", message: "Commande supprimée.", data: deleted });
});

export { getAllCommand, addNewCommande, updateCommande, removeCommand };
