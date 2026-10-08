import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { existsSync } from "fs";
import path from "path";
import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { Types } from "mongoose";
import IMarketplaceOrder, {
  IMarketplaceSubOrder,
  MARKET_ORDER_STATUSES,
  MarketplaceOrderStatus,
  PaymentMethod,
} from "../interface/marketplace-order.interface";
import MarketplaceOrder from "../model/marketplace-order.model";
import ShopPaymentSettings from "../model/shop-payment-settings.model";
import { IShopPaymentMethod } from "../interface/shop-payment-settings.interface";
import { getPaymentProvider } from "../service/payment-provider.service";
import { findBoutiks } from "../service/boutiks.service";
import { getProductById } from "../service/product.service";
import { get_user_group_name } from "../service/user_group_member.service";
import { recordAdminAction } from "../service/admin-audit.service";
import FinancialEntry from "../model/financial-entry.model";
import { notifyUserIfEnabled } from "../service/notification.service";
import { paymentEvidenceDirectory } from "../config/uploadsingle_multer";
import {
  createMarketplaceOrder,
  findOrderById,
  processExpiredMarketplaceOrders,
  refreshGlobalStatus,
  releaseSubOrderStock,
  updateSubOrder,
} from "../service/marketplace-order.service";

const paymentMethods: PaymentMethod[] = [
  "mvola",
  "orange_money",
  "airtel_money",
  "virement",
  "paiement_livraison",
];
const sellerResponseHours = 24;
const paymentDeadlineHours = 24;

const getRequestRole = async (req: Request) => {
  const user = (req as any).user;
  if (!user?._id || !Types.ObjectId.isValid(user._id)) return null;
  return get_user_group_name({ user_id: new Types.ObjectId(user._id) });
};

const safeOrder = (order: any) => {
  const data = order?.toObject ? order.toObject() : { ...order };
  delete data.trackingTokenHash;
  return data;
};

const getSubOrder = (order: any, subOrderId: string): IMarketplaceSubOrder | undefined =>
  order?.subOrders?.find((subOrder: any) => String(subOrder._id) === subOrderId);

const guestTokenMatches = (order: any, token: unknown) => {
  if (typeof token !== "string" || !token || !order?.trackingTokenHash) return false;
  const suppliedHash = createHash("sha256").update(token).digest();
  const savedHash = Buffer.from(order.trackingTokenHash, "hex");
  return suppliedHash.length === savedHash.length && timingSafeEqual(suppliedHash, savedHash);
};

const canActAsBuyer = (req: Request, order: any, token?: unknown) => {
  const user = (req as any).user;
  if (user?._id && order?.owner_id && String(user._id) === String(order.owner_id._id ?? order.owner_id)) return true;
  return !order?.owner_id && guestTokenMatches(order, token);
};

const getSellerShop = async (req: Request) => {
  const role = await getRequestRole(req);
  if (role !== "Boutiks") return null;
  const user = (req as any).user;
  return findBoutiks(String(user._id));
};

const configurePaymentMethods = expressAsyncHandler(async (req: Request, res: Response) => {
  const shop = await getSellerShop(req);
  if (!shop) {
    res.status(403).json({ status: "Failed", message: "Cette action est réservée aux vendeurs." });
    return;
  }

  const deliveryFee = Number(req.body.deliveryFee ?? 0);
  const methods = req.body.paymentMethods;
  if (!Number.isFinite(deliveryFee) || deliveryFee < 0 || !Array.isArray(methods) || methods.length === 0) {
    res.status(400).json({ status: "Failed", message: "Les modes de paiement et les frais de livraison sont invalides." });
    return;
  }

  const uniqueMethods = new Set<string>();
  for (const method of methods) {
    if (
      !paymentMethods.includes(method.method) || uniqueMethods.has(method.method) ||
      typeof method.enabled !== "boolean" || typeof method.recipientName !== "string" ||
      !method.recipientName.trim() || method.recipientName.length > 120 ||
      (method.phone !== undefined && (typeof method.phone !== "string" || method.phone.length > 40)) ||
      (method.account !== undefined && (typeof method.account !== "string" || method.account.length > 120)) ||
      (method.instructions !== undefined && (typeof method.instructions !== "string" || method.instructions.length > 500))
    ) {
      res.status(400).json({ status: "Failed", message: "Un mode de paiement est invalide ou répété." });
      return;
    }
    if (["mvola", "orange_money", "airtel_money"].includes(method.method) && !method.phone?.trim()) {
      res.status(400).json({ status: "Failed", message: "Un numéro de réception est requis pour chaque paiement Mobile Money activé." });
      return;
    }
    if (method.method === "virement" && !method.account?.trim()) {
      res.status(400).json({ status: "Failed", message: "Les coordonnées bancaires sont requises pour le virement." });
      return;
    }
    uniqueMethods.add(method.method);
  }
  if (!methods.some((method: any) => method.enabled)) {
    res.status(400).json({ status: "Failed", message: "Activez au moins un mode de paiement." });
    return;
  }

  const settings = await ShopPaymentSettings.findOneAndUpdate(
    { boutiks_id: shop._id },
    { $set: { deliveryFee, paymentMethods: methods } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  res.status(200).json({ status: "Success", data: settings });
});

const getSellerPaymentMethods = expressAsyncHandler(async (req: Request, res: Response) => {
  const shop = await getSellerShop(req);
  if (!shop) {
    res.status(403).json({ status: "Failed", message: "Cette action est réservée aux vendeurs." });
    return;
  }
  const settings = await ShopPaymentSettings.findOne({ boutiks_id: shop._id }).lean();
  res.status(200).json({ status: "Success", data: settings ?? { deliveryFee: 0, paymentMethods: [] } });
});

const getPublicPaymentMethods = expressAsyncHandler(async (req: Request, res: Response) => {
  if (!Types.ObjectId.isValid(req.params.shopId)) {
    res.status(400).json({ status: "Failed", message: "Boutique invalide." });
    return;
  }
  const settings = await ShopPaymentSettings.findOne({ boutiks_id: req.params.shopId }).lean<any>();
  if (!settings) {
    res.status(404).json({ status: "Failed", message: "Cette boutique n’a pas encore configuré ses modes de paiement." });
    return;
  }
  const enabledMethods = settings.paymentMethods.filter((method: IShopPaymentMethod) => method.enabled).map((method: IShopPaymentMethod) =>
    getPaymentProvider("manual").createInstructions(method),
  );
  res.status(200).json({ status: "Success", data: { deliveryFee: settings.deliveryFee, paymentMethods: enabledMethods } });
});

const createOrder = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const role = await getRequestRole(req);
  if (user && role !== "Client") {
    res.status(403).json({ status: "Failed", message: "Seuls les clients peuvent commander." });
    return;
  }

  const { items, customer, paymentMethods: selectedMethods } = req.body;
  if (!Array.isArray(items) || items.length === 0 || items.length > 50 || !customer || typeof customer !== "object") {
    res.status(400).json({ status: "Failed", message: "Le panier ou les coordonnées de livraison sont invalides." });
    return;
  }
  const customerSnapshot = {
    name: String(customer.name ?? "").trim(),
    phone: String(customer.phone ?? "").trim(),
    email: typeof customer.email === "string" ? customer.email.trim() : undefined,
    address: String(customer.address ?? "").trim(),
    city: typeof customer.city === "string" ? customer.city.trim() : undefined,
  };
  if (!customerSnapshot.name || !customerSnapshot.phone || !customerSnapshot.address || customerSnapshot.name.length > 120 || customerSnapshot.phone.length > 40 || customerSnapshot.address.length > 500) {
    res.status(400).json({ status: "Failed", message: "Le nom, le téléphone et l’adresse sont obligatoires." });
    return;
  }

  const grouped = new Map<string, { shopId: Types.ObjectId; items: IMarketplaceSubOrder["items"]; subtotal: number }>();
  for (const requestedItem of items) {
    const productId = String(requestedItem.productId ?? "");
    const quantity = Number(requestedItem.quantity);
    if (!Types.ObjectId.isValid(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      res.status(400).json({ status: "Failed", message: "Un produit ou une quantité du panier est invalide." });
      return;
    }
    const product = await getProductById(productId);
    if (
      !product ||
      product.publicationStatus !== "Approved" ||
      (product.boutiks_id as any)?.isActive === false ||
      (user && String(product.owner_id) === String(user._id))
    ) {
      res.status(404).json({ status: "Failed", message: "Un produit du panier est introuvable." });
      return;
    }
    const shopId = (product.boutiks_id as any)?._id ?? product.boutiks_id;
    if (!shopId) {
      res.status(409).json({ status: "Failed", message: "Un produit n’est rattaché à aucune boutique." });
      return;
    }

    const variants = requestedItem.variants ?? {};
    if (!variants || typeof variants !== "object" || Array.isArray(variants)) {
      res.status(400).json({ status: "Failed", message: "Les options d’un produit sont invalides." });
      return;
    }
    let unitPrice = Number(product.price);
    for (const [variantName, selectedValue] of Object.entries(variants as Record<string, string>)) {
      const variant = product.variant?.find((item: any) => item.name === variantName);
      const value = variant?.values?.find((item) => item.value === selectedValue);
      if (!value) {
        res.status(400).json({ status: "Failed", message: `Option de produit invalide : ${variantName}.` });
        return;
      }
      unitPrice += Number(value.additionalPrice ?? 0);
    }

    const shopKey = String(shopId);
    const bucket = grouped.get(shopKey) ?? { shopId: new Types.ObjectId(shopKey), items: [], subtotal: 0 };
    bucket.items.push({
      product_id: new Types.ObjectId(productId),
      name: product.name,
      unitPrice,
      quantity,
      image: product.photos?.[0],
      variants: { ...variants },
    });
    bucket.subtotal += unitPrice * quantity;
    grouped.set(shopKey, bucket);
  }

  if (!selectedMethods || typeof selectedMethods !== "object" || Array.isArray(selectedMethods)) {
    res.status(400).json({ status: "Failed", message: "Choisissez un mode de paiement pour chaque boutique." });
    return;
  }

  const subOrders: IMarketplaceSubOrder[] = [];
  for (const [shopKey, bucket] of grouped) {
    const method = selectedMethods[shopKey] as PaymentMethod;
    if (!paymentMethods.includes(method)) {
      res.status(400).json({ status: "Failed", message: "Choisissez un mode de paiement valide pour chaque boutique." });
      return;
    }
    const settings = await ShopPaymentSettings.findOne({ boutiks_id: bucket.shopId }).lean<any>();
    const shop = await MarketplaceOrder.db.model("Boutiks").findById(bucket.shopId).select("commissionPercent").lean<any>();
    const selectedMethod = settings?.paymentMethods.find((entry: IShopPaymentMethod) => entry.method === method && entry.enabled);
    if (!settings || !selectedMethod) {
      res.status(409).json({ status: "Failed", message: "Un mode de paiement sélectionné n’est plus disponible." });
      return;
    }
    const instructions = getPaymentProvider("manual").createInstructions(selectedMethod);
    const expiresAt = new Date(Date.now() + sellerResponseHours * 60 * 60 * 1000);
    subOrders.push({
      boutiks_id: bucket.shopId,
      items: bucket.items,
      subtotal: bucket.subtotal,
      commissionPercent: Number(shop?.commissionPercent ?? 0),
      deliveryFee: settings.deliveryFee,
      payableTotal: bucket.subtotal + settings.deliveryFee,
      paymentMethod: method,
      paymentProviderType: "manual",
      paymentInstructions: {
        recipientName: instructions.recipientName,
        account: instructions.account,
        phone: instructions.phone,
        instructions: instructions.instructions,
      },
      paymentStatus: "a_payer",
      status: "en_attente_vendeur",
      expiresAt,
      reservations: [],
      stockReleased: false,
      shipping: {
        address: customerSnapshot.address,
        city: customerSnapshot.city,
        recipientName: customerSnapshot.name,
        phone: customerSnapshot.phone,
      },
      statusHistory: [{ status: "en_attente_vendeur", actor: user ? "client" : "invite", createdAt: new Date() }],
    });
  }

  const trackingToken = user ? undefined : randomBytes(32).toString("hex");
  let order: IMarketplaceOrder;
  try {
    order = await createMarketplaceOrder({
      owner_id: user?._id,
      customer: customerSnapshot,
      trackingTokenHash: trackingToken ? createHash("sha256").update(trackingToken).digest("hex") : undefined,
      status: "en_attente_vendeur",
      subOrders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de créer la commande.";
    res.status(message.includes("Stock") ? 409 : 400).json({ status: "Failed", message });
    return;
  }

  for (const subOrder of order.subOrders) {
    const shop: any = await MarketplaceOrder.db.model("Boutiks").findById(subOrder.boutiks_id).select("owner_id").lean();
    const sellerOwnerId = shop?.owner_id;
    if (sellerOwnerId) await notifyUserIfEnabled({ _id: sellerOwnerId }, { kind: "order.new", title: "Nouvelle commande", message: `Une commande de ${subOrder.payableTotal} MGA attend votre réponse.`, targetType: "marketplace-order", targetId: String(order._id) });
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(201).json({
    status: "Success",
    message: "Votre commande a été envoyée aux boutiques.",
    data: safeOrder(order),
    ...(trackingToken ? { trackingToken } : {}),
  });
});

const getSellerOrderSummary = expressAsyncHandler(async (req: Request, res: Response) => {
  const role = await getRequestRole(req);
  if (role !== "Boutiks") {
    res.status(403).json({ status: "Failed", message: "Cette synthèse est réservée aux vendeurs." });
    return;
  }
  const shop = await getSellerShop(req);
  if (!shop) {
    res.status(404).json({ status: "Failed", message: "Boutique introuvable." });
    return;
  }
  const summary = await MarketplaceOrder.aggregate([
    { $unwind: "$subOrders" },
    { $match: { "subOrders.boutiks_id": shop._id } },
    { $group: {
      _id: null,
      total: { $sum: 1 },
      pending: { $sum: { $cond: [{ $in: ["$subOrders.status", ["en_attente_vendeur", "paiement_declare"]] }, 1, 0] } },
      inProgress: { $sum: { $cond: [{ $in: ["$subOrders.status", ["paiement_confirme", "en_preparation", "expediee", "litige"]] }, 1, 0] } },
      completed: { $sum: { $cond: [{ $in: ["$subOrders.status", ["livree", "terminee", "partiellement_terminee"]] }, 1, 0] } },
      confirmedSalesMGA: { $sum: { $cond: [{ $eq: ["$subOrders.paymentStatus", "confirme"] }, "$subOrders.payableTotal", 0] } },
    } },
  ]);
  res.status(200).json({ status: "Success", data: summary[0] ?? { total: 0, pending: 0, inProgress: 0, completed: 0, confirmedSalesMGA: 0 } });
});

const listOrders = expressAsyncHandler(async (req: Request, res: Response) => {
  const role = await getRequestRole(req);
  const user = (req as any).user;
  let filter: Record<string, unknown>;
  let sellerShopId: string | undefined;
  if (role === "Super Admin") filter = {};
  else if (role === "Client") filter = { owner_id: user._id };
  else if (role === "Boutiks") {
    const shop = await findBoutiks(String(user._id));
    if (!shop) {
      res.status(200).json({ status: "Success", data: [] });
      return;
    }
    sellerShopId = String(shop._id);
    filter = { "subOrders.boutiks_id": shop._id };
  } else {
    res.status(403).json({ status: "Failed", message: "Accès refusé." });
    return;
  }

  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "25"), 10) || 25));
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const requestedStatus = typeof req.query.status === "string" ? req.query.status : "";
  if (requestedStatus && requestedStatus !== "all" && !(MARKET_ORDER_STATUSES as readonly string[]).includes(requestedStatus)) {
    res.status(400).json({ status: "Failed", message: "Filtre de statut invalide." });
    return;
  }
  if (requestedStatus && requestedStatus !== "all") {
    filter.subOrders = role === "Boutiks"
      ? { $elemMatch: { boutiks_id: new Types.ObjectId(String(sellerShopId)), status: requestedStatus } }
      : { $elemMatch: { status: requestedStatus } };
  }
  if (search) filter.$or = [
    { "customer.name": { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
    { "customer.phone": { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
  ];

  const [orders, total] = await Promise.all([MarketplaceOrder.find(filter)
    .populate("owner_id", "username email phonenumber")
    .populate("subOrders.boutiks_id", "name phoneNumber whatsappNumber email logo ville adresse")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit).limit(limit).lean(), MarketplaceOrder.countDocuments(filter)]);
  const visibleOrders = role === "Boutiks"
    ? orders.map((order: any) => ({ ...order, subOrders: order.subOrders.filter((subOrder: any) => String(subOrder.boutiks_id?._id ?? subOrder.boutiks_id) === sellerShopId) }))
    : orders;
  let responseOrders = visibleOrders;
  if (role === "Client") {
    const sourceIds = visibleOrders.flatMap((order: any) => order.subOrders.map((subOrder: any) => String(subOrder._id)));
    const refunds = sourceIds.length
      ? await FinancialEntry.find({ kind: "refund", sourceType: "marketplace", sourceId: { $in: sourceIds }, ownerId: user._id })
        .select("sourceId amountMGA createdAt")
        .sort({ createdAt: -1 })
        .lean<any[]>()
      : [];
    const refundsBySubOrder = new Map<string, any[]>();
    for (const refund of refunds) {
      const current = refundsBySubOrder.get(refund.sourceId) ?? [];
      current.push({ amountMGA: refund.amountMGA, createdAt: refund.createdAt });
      refundsBySubOrder.set(refund.sourceId, current);
    }
    responseOrders = visibleOrders.map((order: any) => ({
      ...order,
      subOrders: order.subOrders.map((subOrder: any) => {
        const refundHistory = refundsBySubOrder.get(String(subOrder._id)) ?? [];
        return {
          ...subOrder,
          refundedMGA: refundHistory.reduce((total: number, refund: any) => total + Number(refund.amountMGA), 0),
          refundHistory,
        };
      }),
    }));
  }
  res.status(200).json({ status: "Success", data: responseOrders.map(safeOrder), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

const listDisputes = expressAsyncHandler(async (req: Request, res: Response) => {
  if (await getRequestRole(req) !== "Super Admin") {
    res.status(403).json({ status: "Failed", message: "Accès réservé au Super Admin." });
    return;
  }
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "25"), 10) || 25));
  const filter = { "subOrders.status": "litige" };
  const [orders, total] = await Promise.all([MarketplaceOrder.find(filter)
    .populate("owner_id", "username email phonenumber")
    .populate("subOrders.boutiks_id", "name phoneNumber whatsappNumber email logo ville adresse")
    .sort({ updatedAt: -1 })
    .skip((page - 1) * limit).limit(limit).lean(), MarketplaceOrder.countDocuments(filter)]);
  res.status(200).json({ status: "Success", data: orders.map(safeOrder), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

const getOrderForTracking = expressAsyncHandler(async (req: Request, res: Response) => {
  const order = await findOrderById(req.params.orderId, true);
  if (!order) {
    res.status(404).json({ status: "Failed", message: "Commande introuvable." });
    return;
  }
  const token = req.get("x-order-token") ?? req.query.token;
  if (!canActAsBuyer(req, order, token)) {
    res.status(403).json({ status: "Failed", message: "Lien de suivi invalide ou accès refusé." });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ status: "Success", data: safeOrder(order) });
});

const authorizePaymentEvidenceUpload = expressAsyncHandler(async (req: Request, res: Response, next) => {
  const order = await findOrderById(req.params.orderId, true);
  const token = req.get("x-order-token") ?? req.query.token;
  if (!order || !canActAsBuyer(req, order, token)) {
    res.status(403).json({ status: "Failed", message: "Accès refusé." });
    return;
  }
  next();
});

const declarePayment = expressAsyncHandler(async (req: Request, res: Response) => {
  const order = await findOrderById(req.params.orderId, true);
  if (!order) {
    res.status(404).json({ status: "Failed", message: "Commande introuvable." });
    return;
  }
  const token = req.get("x-order-token") ?? req.body.trackingToken;
  if (!canActAsBuyer(req, order, token)) {
    res.status(403).json({ status: "Failed", message: "Accès refusé." });
    return;
  }
  const subOrder = getSubOrder(order, req.params.subOrderId);
  const reference = String(req.body.reference ?? "").trim();
  if (!subOrder || subOrder.status !== "en_attente_paiement" || subOrder.paymentMethod === "paiement_livraison") {
    res.status(409).json({ status: "Failed", message: "Cette sous-commande n’attend pas une déclaration de paiement." });
    return;
  }
  if (!reference || reference.length > 120) {
    res.status(400).json({ status: "Failed", message: "La référence de transaction est obligatoire." });
    return;
  }
  const evidencePath = (req as any).file?.filename;
  const updated = await updateSubOrder(
    req.params.orderId,
    req.params.subOrderId,
    {
      status: "paiement_declare",
      paymentStatus: "declare",
      paymentDeclaration: { reference, evidencePath, declaredAt: new Date() },
      expiresAt: null,
    },
    { expectedStatus: "en_attente_paiement", actor: "client", note: "Paiement déclaré." },
  );
  res.status(updated ? 200 : 409).json({ status: updated ? "Success" : "Failed", data: updated ? safeOrder(updated) : undefined, message: updated ? "Le paiement a été déclaré au vendeur." : "La commande a changé d’état, veuillez actualiser." });
});

const getPaymentEvidence = expressAsyncHandler(async (req: Request, res: Response) => {
  const order = await findOrderById(req.params.orderId, true);
  const subOrder = getSubOrder(order, req.params.subOrderId);
  const filename = subOrder?.paymentDeclaration?.evidencePath;
  if (!order || !subOrder || !filename) {
    res.status(404).json({ status: "Failed", message: "Justificatif introuvable." });
    return;
  }

  const user = (req as any).user;
  const role = await getRequestRole(req);
  const token = req.get("x-order-token") ?? req.query.token;
  const isBuyer = canActAsBuyer(req, order, token);
  const shop = role === "Boutiks" && user?._id ? await findBoutiks(String(user._id)) : null;
  const isSeller = Boolean(shop && String(shop._id) === String(subOrder.boutiks_id?._id ?? subOrder.boutiks_id));
  if (!isBuyer && !isSeller && role !== "Super Admin") {
    res.status(403).json({ status: "Failed", message: "Accès refusé." });
    return;
  }

  const safeFilename = path.basename(filename);
  if (safeFilename !== filename || !/^[a-f0-9-]+\.(jpe?g|png|webp)$/i.test(safeFilename)) {
    res.status(404).json({ status: "Failed", message: "Justificatif introuvable." });
    return;
  }
  const filePath = path.join(paymentEvidenceDirectory, safeFilename);
  if (!existsSync(filePath)) {
    res.status(404).json({ status: "Failed", message: "Justificatif introuvable." });
    return;
  }
  res.setHeader("Cache-Control", "private, no-store");
  res.sendFile(filePath);
});

const issueSubOrderInvoice = expressAsyncHandler(async (req: Request, res: Response) => {
  const order = await findOrderById(req.params.orderId);
  const subOrder = getSubOrder(order, req.params.subOrderId);
  const shop = await getSellerShop(req);
  if (!order || !subOrder || !shop || String(shop._id) !== String(subOrder.boutiks_id?._id ?? subOrder.boutiks_id)) {
    res.status(404).json({ status: "Failed", message: "Commande boutique introuvable." });
    return;
  }
  if (subOrder.paymentStatus !== "confirme") {
    res.status(409).json({ status: "Failed", message: "La facture peut être émise après confirmation du paiement." });
    return;
  }
  if (subOrder.invoiceNumber) {
    res.status(200).json({ status: "Success", data: { invoiceNumber: subOrder.invoiceNumber, invoiceIssuedAt: subOrder.invoiceIssuedAt }, message: "La facture existe déjà." });
    return;
  }
  const invoiceNumber = `FAC-${new Date().getFullYear()}-${String(order._id).slice(-6).toUpperCase()}-${String(subOrder._id).slice(-6).toUpperCase()}`;
  const updated = await updateSubOrder(req.params.orderId, req.params.subOrderId, { invoiceNumber, invoiceIssuedAt: new Date() });
  const issued = updated && getSubOrder(updated, req.params.subOrderId);
  res.status(issued?.invoiceNumber ? 200 : 409).json({
    status: issued?.invoiceNumber ? "Success" : "Failed",
    data: issued ? { invoiceNumber: issued.invoiceNumber, invoiceIssuedAt: issued.invoiceIssuedAt } : undefined,
    message: issued?.invoiceNumber ? "Facture émise. Le client peut maintenant la télécharger." : "Impossible d’émettre la facture, actualisez la commande.",
  });
});

const escapeInvoiceHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;").replace(/'/g, "&#39;");

const downloadSubOrderInvoice = expressAsyncHandler(async (req: Request, res: Response) => {
  const order = await findOrderById(req.params.orderId);
  const subOrder = getSubOrder(order, req.params.subOrderId);
  if (!order || !subOrder || !subOrder.invoiceNumber || !subOrder.invoiceIssuedAt) {
    res.status(404).json({ status: "Failed", message: "Facture indisponible." });
    return;
  }
  const token = req.get("x-order-token") ?? req.query.token;
  const buyer = canActAsBuyer(req, order, token);
  const shop = await getSellerShop(req);
  const seller = Boolean(shop && String(shop._id) === String(subOrder.boutiks_id?._id ?? subOrder.boutiks_id));
  if (!buyer && !seller && await getRequestRole(req) !== "Super Admin") {
    res.status(403).json({ status: "Failed", message: "Accès refusé." });
    return;
  }
  const shopData: any = subOrder.boutiks_id;
  const esc = escapeInvoiceHtml;
  const date = new Date(subOrder.invoiceIssuedAt).toLocaleDateString("fr-FR");
  const rows = subOrder.items.map((item) => `<tr><td>${esc(item.name)}${Object.keys(item.variants ?? {}).length ? `<small>${esc(Object.entries(item.variants).map(([key, value]) => `${key}: ${value}`).join(" · "))}</small>` : ""}</td><td>${item.quantity}</td><td>${Number(item.unitPrice).toLocaleString("fr-FR")} MGA</td><td>${(Number(item.unitPrice) * Number(item.quantity)).toLocaleString("fr-FR")} MGA</td></tr>`).join("");
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Facture ${esc(subOrder.invoiceNumber)}</title><style>body{font:15px Arial,sans-serif;color:#17211d;margin:40px auto;max-width:850px;padding:0 24px}header,.row{display:flex;justify-content:space-between;gap:24px}h1{font-size:30px;margin:0 0 8px}small{display:block;color:#66736d;margin-top:5px}.muted{color:#66736d}table{border-collapse:collapse;width:100%;margin:32px 0}th,td{text-align:left;border-bottom:1px solid #dce5df;padding:13px 9px}th{background:#f1f6f3}.total{margin-left:auto;width:min(320px,100%)}.total p{display:flex;justify-content:space-between}.grand{font-size:20px;font-weight:bold;border-top:2px solid #183e2d;padding-top:14px}@media print{body{margin:15mm auto}button{display:none}}</style><body><header><div><h1>FACTURE</h1><strong>${esc(subOrder.invoiceNumber)}</strong><p class="muted">Émise le ${esc(date)}</p></div><div><strong>${esc(shopData?.name ?? "Boutique")}</strong><p>${esc(shopData?.adresse ?? "")}${shopData?.ville ? `, ${esc(shopData.ville)}` : ""}</p><p>${esc(shopData?.phoneNumber ?? "")}${shopData?.email ? ` · ${esc(shopData.email)}` : ""}</p></div></header><section class="row"><div><strong>Facturé à</strong><p>${esc(order.customer.name)}<br>${esc(order.customer.address)}${order.customer.city ? `, ${esc(order.customer.city)}` : ""}<br>${esc(order.customer.phone)}${order.customer.email ? `<br>${esc(order.customer.email)}` : ""}</p></div><div><strong>Commande</strong><p>#${esc(String(order._id).slice(-8).toUpperCase())}<br>Mode de paiement : ${esc(subOrder.paymentMethod)}<br>Statut : payé</p></div></section><table><thead><tr><th>Article</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="total"><p><span>Sous-total</span><strong>${Number(subOrder.subtotal).toLocaleString("fr-FR")} MGA</strong></p><p><span>Livraison</span><strong>${Number(subOrder.deliveryFee).toLocaleString("fr-FR")} MGA</strong></p><p class="grand"><span>Total payé</span><strong>${Number(subOrder.payableTotal).toLocaleString("fr-FR")} MGA</strong></p></div><p class="muted">Merci pour votre commande.</p><button onclick="window.print()">Imprimer / Enregistrer en PDF</button></body></html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  const disposition = req.query.view === "1" ? "inline" : "attachment";
  res.setHeader("Content-Disposition", `${disposition}; filename="${subOrder.invoiceNumber}.html"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.send(html);
});

const updateSubOrderStatus = expressAsyncHandler(async (req: Request, res: Response) => {
  const order = await findOrderById(req.params.orderId, true);
  if (!order) {
    res.status(404).json({ status: "Failed", message: "Commande introuvable." });
    return;
  }
  const subOrder = getSubOrder(order, req.params.subOrderId);
  if (!subOrder) {
    res.status(404).json({ status: "Failed", message: "Sous-commande introuvable." });
    return;
  }

  const role = await getRequestRole(req);
  const user = (req as any).user;
  const token = req.get("x-order-token") ?? req.body.trackingToken;
  const isBuyer = canActAsBuyer(req, order, token);
  const shop = role === "Boutiks" ? await findBoutiks(String(user._id)) : null;
  const isSeller = Boolean(shop && String(shop._id) === String(subOrder.boutiks_id?._id ?? subOrder.boutiks_id));
  const status = req.body.status as MarketplaceOrderStatus;
  const note = typeof req.body.reason === "string" ? req.body.reason.trim() : "";
  let updates: Record<string, unknown> = { status };
  let allowed = false;

  if (status === "litige") {
    allowed = (isBuyer || isSeller) && !["terminee", "annulee", "refusee", "expiree"].includes(subOrder.status);
    if (allowed) updates.disputePreviousStatus = subOrder.status;
  } else if (status === "annulee") {
    allowed = (isBuyer || isSeller) && ["en_attente_vendeur", "en_attente_paiement"].includes(subOrder.status);
  } else if (isBuyer && status === "terminee") {
    allowed = subOrder.status === "livree" && subOrder.paymentStatus === "confirme";
  } else if (isSeller && status === "refusee") {
    allowed = subOrder.status === "en_attente_vendeur" && note.length > 0;
  } else if (isSeller && status === "en_attente_paiement") {
    allowed = subOrder.status === "en_attente_vendeur" && subOrder.paymentMethod !== "paiement_livraison";
    if (allowed) updates.expiresAt = new Date(Date.now() + paymentDeadlineHours * 60 * 60 * 1000);
  } else if (isSeller && status === "en_preparation") {
    allowed = subOrder.status === "paiement_confirme" || (subOrder.status === "en_attente_vendeur" && subOrder.paymentMethod === "paiement_livraison");
    updates.expiresAt = null;
  } else if (isSeller && status === "expediee") {
    allowed = subOrder.status === "en_preparation";
    updates["shipping.carrier"] = typeof req.body.carrier === "string" ? req.body.carrier.trim().slice(0, 80) : undefined;
    updates["shipping.trackingNumber"] = typeof req.body.trackingNumber === "string" ? req.body.trackingNumber.trim().slice(0, 120) : undefined;
  } else if (isSeller && status === "livree") {
    allowed = subOrder.status === "expediee";
    if (subOrder.paymentMethod === "paiement_livraison" && req.body.paymentReceived === true) updates.paymentStatus = "confirme";
  }

  if (!allowed) {
    res.status(403).json({ status: "Failed", message: "Cette transition de sous-commande n’est pas autorisée." });
    return;
  }
  if (status === "refusee" && note.length > 500) {
    res.status(400).json({ status: "Failed", message: "Le motif de refus est trop long." });
    return;
  }

  const updated = await updateSubOrder(
    req.params.orderId,
    req.params.subOrderId,
    updates,
    { expectedStatus: subOrder.status, actor: isSeller ? "vendeur" : isBuyer ? "client" : "super_admin", note: note || undefined },
  );
  if (!updated) {
    res.status(409).json({ status: "Failed", message: "La sous-commande a changé d’état, veuillez actualiser." });
    return;
  }
  if (["annulee", "refusee"].includes(status)) {
    await releaseSubOrderStock(req.params.orderId, req.params.subOrderId);
  }
  if (updated && isSeller && order.owner_id) await notifyUserIfEnabled({ _id: (order.owner_id as any)._id ?? order.owner_id }, { kind: "order.status", title: "Mise à jour de commande", message: `Votre commande est maintenant : ${status}.`, targetType: "marketplace-order", targetId: String(order._id) });
  res.status(200).json({ status: "Success", message: "Sous-commande mise à jour.", data: safeOrder(updated) });
});

const confirmPayment = expressAsyncHandler(async (req: Request, res: Response) => {
  const order = await findOrderById(req.params.orderId);
  if (!order) {
    res.status(404).json({ status: "Failed", message: "Commande introuvable." });
    return;
  }
  const role = await getRequestRole(req);
  const user = (req as any).user;
  const shop = role === "Boutiks" ? await findBoutiks(String(user._id)) : null;
  const subOrder = getSubOrder(order, req.params.subOrderId);
  if (!subOrder || !shop || String(shop._id) !== String(subOrder.boutiks_id?._id ?? subOrder.boutiks_id)) {
    res.status(403).json({ status: "Failed", message: "Seul le vendeur concerné peut confirmer le paiement." });
    return;
  }
  const isDeclaredPayment = subOrder.status === "paiement_declare";
  const isCashOnDeliveryReceipt = subOrder.status === "livree" && subOrder.paymentMethod === "paiement_livraison";
  if (!isDeclaredPayment && !isCashOnDeliveryReceipt) {
    res.status(409).json({ status: "Failed", message: "Aucun paiement à confirmer pour cette sous-commande." });
    return;
  }
    const updates: Record<string, unknown> = { paymentStatus: "confirme", paymentConfirmedAt: new Date() };
  if (isDeclaredPayment) updates.status = "paiement_confirme";
  const updated = await updateSubOrder(
    req.params.orderId,
    req.params.subOrderId,
    updates,
    { expectedStatus: subOrder.status, actor: "vendeur", note: "Réception du paiement confirmée par le vendeur." },
  );
  if (updated && order.owner_id) await notifyUserIfEnabled({ _id: (order.owner_id as any)._id ?? order.owner_id }, { kind: "order.payment", title: "Paiement reçu par le vendeur", message: `Le vendeur a confirmé ${subOrder.payableTotal} MGA.`, targetType: "marketplace-order", targetId: String(order._id) });
  if (updated) await FinancialEntry.updateOne({ kind: "marketplace_payment", sourceId: String(subOrder._id) }, { $setOnInsert: { kind: "marketplace_payment", sourceId: String(subOrder._id), sourceType: "marketplace", amountMGA: Number(subOrder.payableTotal ?? 0), ownerId: order.owner_id } }, { upsert: true });
  res.status(updated ? 200 : 409).json({ status: updated ? "Success" : "Failed", data: updated ? safeOrder(updated) : undefined, message: updated ? "Réception du paiement confirmée." : "La commande a changé d’état, veuillez actualiser." });
});

const resolveDispute = expressAsyncHandler(async (req: Request, res: Response) => {
  if (await getRequestRole(req) !== "Super Admin") {
    res.status(403).json({ status: "Failed", message: "Accès réservé au Super Admin." });
    return;
  }
  const resolution = req.body.status as MarketplaceOrderStatus;
  if (!resolution || resolution === "litige" || resolution === "partiellement_terminee" || !(MARKET_ORDER_STATUSES as readonly string[]).includes(resolution)) {
    res.status(400).json({ status: "Failed", message: "Décision de litige invalide." });
    return;
  }
  const order = await findOrderById(req.params.orderId);
  const subOrder = getSubOrder(order, req.params.subOrderId);
  if (!subOrder || subOrder.status !== "litige") {
    res.status(404).json({ status: "Failed", message: "Litige introuvable." });
    return;
  }
  const updated = await updateSubOrder(
    req.params.orderId,
    req.params.subOrderId,
    {
      status: resolution,
      disputePreviousStatus: null,
      ...(resolution === "paiement_confirme" ? { paymentStatus: "confirme", paymentConfirmedAt: new Date() } : {}),
    },
    { expectedStatus: "litige", actor: "super_admin", note: String(req.body.reason ?? "Décision du Super Admin.").slice(0, 500) },
  );
  if (["annulee", "refusee", "expiree"].includes(resolution)) {
    await releaseSubOrderStock(req.params.orderId, req.params.subOrderId);
  }
    if (updated) await recordAdminAction({ actorId: String((req as any).user._id), actorName: (req as any).user.username ?? "Super Admin", action: `marketplace.dispute.${resolution}`, targetType: "marketplace-order", targetId: req.params.orderId, targetLabel: req.params.subOrderId, reason: String(req.body.reason ?? "").slice(0, 500), ip: req.ip });
  res.status(updated ? 200 : 409).json({ status: updated ? "Success" : "Failed", data: updated ? safeOrder(updated) : undefined, message: updated ? "Litige traité." : "Le litige a changé d’état." });
});

const expireOrders = () => processExpiredMarketplaceOrders();

export {
  configurePaymentMethods,
  authorizePaymentEvidenceUpload,
  confirmPayment,
  createOrder,
  declarePayment,
  expireOrders,
  getOrderForTracking,
  getPaymentEvidence,
  downloadSubOrderInvoice,
  issueSubOrderInvoice,
  getPublicPaymentMethods,
  getSellerPaymentMethods,
  getSellerOrderSummary,
  listDisputes,
  listOrders,
  resolveDispute,
  updateSubOrderStatus,
};
