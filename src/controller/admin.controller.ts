import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { Types } from "mongoose";
import AdminAudit from "../model/admin-audit.model";
import { get_user_group_name } from "../service/user_group_member.service";
import { recordAdminAction } from "../service/admin-audit.service";
import SubscriptionPlan from "../model/subscription-plan.model";
import Subscription from "../model/abonnement.model";
import FinancialEntry from "../model/financial-entry.model";
import MarketplaceOrder from "../model/marketplace-order.model";
import { getUser } from "../service/user.service";
import jwt from "jsonwebtoken";
import Boutiks from "../model/boutiks.model";
import { getSubscriptionPaymentMethods, saveSubscriptionPaymentMethods } from "../service/subscription-payment-method.service";
import PlatformSettings from "../model/platform-settings.model";
import ContactTicket from "../model/contact-ticket.model";
import PersonnalInfo from "../model/personnalInfo";
import Product from "../model/product.model";
import Comment from "../model/comment.model";
import UserGroupMember from "../model/userGroupMember.model";
import UserGroup from "../model/userGroup.model";
import sendEmail from "../helpers/mail";
import { createAdminStepUpCode, storeAdminStepUpToken, verifyAdminStepUpCode } from "../service/admin-step-up.service";
import { hasAdminPermission } from "../service/admin-permissions.service";

const listAdminAudit = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (await get_user_group_name({ user_id: new Types.ObjectId(String(user._id)) }) !== "Super Admin") {
    res.status(403).json({ status: "Failed", message: "Accès réservé au Super Admin." }); return;
  }
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "30"), 10) || 30));
  const filter: Record<string, unknown> = {};
  if (typeof req.query.action === "string") filter.action = { $regex: req.query.action.slice(0, 60), $options: "i" };
  if (typeof req.query.targetType === "string") filter.targetType = req.query.targetType.slice(0, 60);
  const [data, total] = await Promise.all([
    AdminAudit.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AdminAudit.countDocuments(filter),
  ]);
  res.status(200).json({ status: "Success", data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

const listAdminCategories = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (await get_user_group_name({ user_id: new Types.ObjectId(String(user._id)) }) !== "Super Admin") {
    res.status(403).json({ status: "Failed", message: "Accès réservé au Super Admin." }); return;
  }
  const baseUrl = process.env.CATEGORY_API_URL?.replace(/\/$/, "");
  if (!baseUrl) { res.status(503).json({ status: "Failed", message: "L’URL de CategoryApi n’est pas configurée côté backend." }); return; }
  const token = process.env.CATEGORY_API_ADMIN_TOKEN;
  const response = await fetch(`${baseUrl}/all/category`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const result: any = await response.json().catch(() => ({}));
  if (!response.ok) { res.status(502).json({ status: "Failed", message: result.message || "Le catalogue est indisponible." }); return; }
  res.status(200).json({ status: "Success", data: result.category ?? [] });
});

const createAdminCategory = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (await get_user_group_name({ user_id: new Types.ObjectId(String(user._id)) }) !== "Super Admin") {
    res.status(403).json({ status: "Failed", message: "Accès réservé au Super Admin." }); return;
  }
  const { name, slug, parentSlug } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80 || typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || (parentSlug !== undefined && (typeof parentSlug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parentSlug)))) {
    res.status(400).json({ status: "Failed", message: "Nom, identifiant ou catégorie parente invalide." }); return;
  }
  const baseUrl = process.env.CATEGORY_API_URL?.replace(/\/$/, "");
  if (!baseUrl) { res.status(503).json({ status: "Failed", message: "L’URL de CategoryApi n’est pas configurée côté backend." }); return; }
  const token = process.env.CATEGORY_API_ADMIN_TOKEN;
  const endpoint = parentSlug ? `${baseUrl}/${encodeURIComponent(parentSlug)}/add` : `${baseUrl}/store/category`;
  const response = await fetch(endpoint, { method: "POST", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), slug }) });
  const result: any = await response.json().catch(() => ({}));
  if (!response.ok) { res.status(response.status === 409 ? 409 : 502).json({ status: "Failed", message: result.message || "Création de la catégorie impossible." }); return; }
  const category = result.category;
  await recordAdminAction({ actorId: String(user._id), actorName: user.username ?? "Super Admin", action: "category.created", targetType: "category", targetId: String(category?._id ?? slug), targetLabel: name.trim(), reason: parentSlug ? `parent:${parentSlug}` : "catégorie racine", ip: req.ip });
  res.status(201).json({ status: "Success", message: "Catégorie créée.", data: category });
});

const requireSuperAdmin = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (await get_user_group_name({ user_id: new Types.ObjectId(String(user?._id)) }) !== "Super Admin") {
    res.status(403).json({ status: "Failed", message: "Accès réservé au Super Admin." }); return false;
  }
  return true;
};

const requestAdminStepUp = expressAsyncHandler(async (req: Request, res: Response) => {
  const actor = (req as any).user;
  const canConfirmAdminActions = ["moderation.review", "support.manage", "finance.refund", "finance.payout"].some((permission) => hasAdminPermission(actor, permission));
  if (!canConfirmAdminActions) {
    res.status(403).json({ status: "Failed", message: "Un rôle administratif autorisé est requis." });
    return;
  }
  const challenge = await createAdminStepUpCode(String(actor._id));
  if (!challenge) {
    res.status(429).json({ status: "Failed", message: "Attendez une minute avant de demander un nouveau code." });
    return;
  }
  try {
    await sendEmail({
      title: "Confirmation d’une action administrateur",
      message: "Voici votre code de confirmation à usage unique.",
      information: `Code : ${challenge.code}`,
      content: "Ce code expire dans 10 minutes. Ne le partagez avec personne.",
    }, challenge.email, "Code de confirmation administrateur");
  } catch (error) {
    console.error("Failed to send admin step-up code", error instanceof Error ? error.message : "Unknown email error");
    res.status(503).json({ status: "Failed", message: "Impossible d’envoyer le code de confirmation. Réessayez plus tard." });
    return;
  }
  res.status(200).json({ status: "Success", message: "Un code de confirmation a été envoyé à votre adresse e-mail." });
});

const verifyAdminStepUp = expressAsyncHandler(async (req: Request, res: Response) => {
  const actor = (req as any).user;
  const canConfirmAdminActions = ["moderation.review", "support.manage", "finance.refund", "finance.payout"].some((permission) => hasAdminPermission(actor, permission));
  if (!canConfirmAdminActions) {
    res.status(403).json({ status: "Failed", message: "Un rôle administratif autorisé est requis." });
    return;
  }
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ status: "Failed", message: "Saisissez le code à 6 chiffres reçu par e-mail." });
    return;
  }
  const userId = String(actor._id);
  if (!await verifyAdminStepUpCode(userId, code)) {
    res.status(403).json({ status: "Failed", message: "Le code est invalide, expiré ou le nombre d’essais est dépassé." });
    return;
  }
  const secret = process.env.TOKEN_SECRET;
  if (!secret) {
    res.status(500).json({ status: "Failed", message: "L’authentification n’est pas configurée." });
    return;
  }
  const token = jwt.sign({ userId, purpose: "admin-step-up" }, secret, { expiresIn: "5m" });
  await storeAdminStepUpToken(userId, token);
  res.status(200).json({ status: "Success", token, expiresInSeconds: 300 });
});

const seedPlans = async () => {
  await SubscriptionPlan.updateOne({ key: "free" }, { $setOnInsert: { name: "Gratuit", monthlyPriceMGA: 0, durationDays: 30, graceDays: 3, maxProducts: 0, features: { advancedAnalytics: false, prioritySupport: false, customCategories: false }, active: true } }, { upsert: true });
  await SubscriptionPlan.updateOne({ key: "pro" }, { $setOnInsert: { name: "Pro", monthlyPriceMGA: 0, durationDays: 30, graceDays: 3, maxProducts: 0, features: { advancedAnalytics: false, prioritySupport: false, customCategories: false }, active: true } }, { upsert: true });
};

const listAdminPlans = expressAsyncHandler(async (req: Request, res: Response) => {
  if (!await requireSuperAdmin(req, res)) return;
  await seedPlans();
  res.status(200).json({ status: "Success", data: await SubscriptionPlan.find().sort({ key: 1 }).lean() });
});

const updateAdminPlan = expressAsyncHandler(async (req: Request, res: Response) => {
  if (!await requireSuperAdmin(req, res)) return;
  const { key } = req.params; const body = req.body ?? {};
  if (!["free", "pro"].includes(key) || typeof body.name !== "string" || !body.name.trim() || !Number.isSafeInteger(body.monthlyPriceMGA) || body.monthlyPriceMGA < 0 || body.monthlyPriceMGA > 1000000000 || !Number.isInteger(body.durationDays) || body.durationDays < 1 || body.durationDays > 366 || !Number.isInteger(body.graceDays) || body.graceDays < 0 || body.graceDays > 30 || !Number.isInteger(body.maxProducts) || body.maxProducts < 0 || body.maxProducts > 1000000 || typeof body.active !== "boolean" || !body.features || ["advancedAnalytics", "prioritySupport", "customCategories"].some((feature) => typeof body.features[feature] !== "boolean")) {
    res.status(400).json({ status: "Failed", message: "Configuration du forfait invalide." }); return;
  }
  const data = await SubscriptionPlan.findOneAndUpdate({ key }, { $set: { name: body.name.trim().slice(0, 80), monthlyPriceMGA: body.monthlyPriceMGA, durationDays: body.durationDays, graceDays: body.graceDays, maxProducts: body.maxProducts, active: body.active, features: body.features } }, { upsert: true, new: true, runValidators: true }).lean();
  if (key === "pro") {
    const currentPayments = await getSubscriptionPaymentMethods();
    await saveSubscriptionPaymentMethods(currentPayments.methods, body.monthlyPriceMGA);
  }
  const actor = (req as any).user;
  await recordAdminAction({ actorId: String(actor._id), actorName: actor.username ?? "Super Admin", action: "subscription.plan.updated", targetType: "subscription-plan", targetId: key, targetLabel: (data as any)?.name ?? key, reason: "Règles commerciales mises à jour", ip: req.ip });
  res.status(200).json({ status: "Success", data });
});

const getSellerEntitlements = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const boutik = await Boutiks.findOne({ owner_id: user._id }).populate("subscription_id").lean<any>();
  if (!boutik) { res.status(404).json({ status: "Failed", message: "Boutique introuvable." }); return; }
  const subscription = boutik.subscription_id;
  const withinGrace = subscription?.lifecycleStatus === "grace" && subscription.graceUntil && new Date(subscription.graceUntil).getTime() > Date.now();
  const planKey = subscription?.payementStatus === "Completed" && ((subscription.endDate && new Date(subscription.endDate).getTime() > Date.now()) || withinGrace) ? "pro" : "free";
  await seedPlans();
  const plan = await SubscriptionPlan.findOne({ key: planKey, active: true }).lean<any>();
  const Product = (await import("../model/product.model")).default;
  const [used, lowStock] = await Promise.all([Product.countDocuments({ boutiks_id: boutik._id }), Product.countDocuments({ boutiks_id: boutik._id, stock: { $lte: 5 } })]);
  res.status(200).json({ status: "Success", data: { plan: planKey, name: plan?.name ?? planKey, quota: plan?.maxProducts ?? 0, used, remaining: plan?.maxProducts ? Math.max(0, plan.maxProducts - used) : null, lowStock, features: plan?.features ?? {} } });
});

const startSellerImpersonation = expressAsyncHandler(async (req: Request, res: Response) => {
  if (!await requireSuperAdmin(req, res)) return;
  const actor = (req as any).user; const targetId = req.params.userId; const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!Types.ObjectId.isValid(targetId) || reason.length < 8 || reason.length > 500) { res.status(400).json({ status: "Failed", message: "Vendeur ou motif d’impersonnalisation invalide (8 à 500 caractères requis)." }); return; }
  const target = await getUser(targetId);
  if (!target || (target as any).userGroupMember_id?.usergroup_id?.name !== "Boutiks" || !(target as any).boutiks_id) { res.status(404).json({ status: "Failed", message: "Compte vendeur actif introuvable." }); return; }
  const secret = process.env.TOKEN_SECRET;
  if (!secret) { res.status(500).json({ status: "Failed", message: "Authentification non configurée." }); return; }
  const token = jwt.sign({ purpose: "seller-impersonation", actorId: String(actor._id), targetId, reason }, secret, { expiresIn: "15m" });
  res.cookie("adminImpersonation", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 15 * 60 * 1000, path: "/" });
  await recordAdminAction({ actorId: String(actor._id), actorName: actor.username ?? "Super Admin", action: "seller.impersonation.started", targetType: "user", targetId, targetLabel: target.username, reason, ip: req.ip });
  res.status(200).json({ status: "Success", expiresInSeconds: 900, target: { id: targetId, username: target.username } });
});

const stopSellerImpersonation = expressAsyncHandler(async (req: Request, res: Response) => {
  const info = (req as any).impersonation;
  if (!info) { res.status(409).json({ status: "Failed", message: "Aucune session vendeur active." }); return; }
  res.clearCookie("adminImpersonation", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/" });
  await recordAdminAction({ actorId: info.actorId, actorName: info.actorName ?? "Super Admin", action: "seller.impersonation.ended", targetType: "user", targetId: info.targetId, targetLabel: info.targetName ?? "Vendeur", reason: info.reason ?? "", ip: req.ip });
  res.status(200).json({ status: "Success", message: "Session vendeur terminée." });
});

const getFinancialReport = expressAsyncHandler(async (req: Request, res: Response) => {
  if (!hasAdminPermission((req as any).user, "finance.read")) {
    res.status(403).json({ status: "Failed", message: "Permission de lecture financière insuffisante." });
    return;
  }
  const now = new Date(); const from = typeof req.query.from === "string" ? new Date(req.query.from) : new Date(now.getTime() - 30 * 86400000); const to = typeof req.query.to === "string" ? new Date(req.query.to) : now;
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to || to.getTime() - from.getTime() > 366 * 86400000) { res.status(400).json({ status: "Failed", message: "Période invalide (maximum 366 jours)." }); return; }
  const paidDate = { $gte: from, $lte: to };
  const [subscriptionRevenue, marketplaceRows, refunds, upcoming, subPayments, marketPayments] = await Promise.all([
    Subscription.aggregate([{ $match: { payementStatus: "Completed" } }, { $addFields: { paidAt: { $ifNull: ["$paymentCompletedAt", "$createdAt"] } } }, { $match: { paidAt: paidDate } }, { $group: { _id: null, total: { $sum: "$priceMGA" }, count: { $sum: 1 } } }]),
    MarketplaceOrder.aggregate([{ $unwind: "$subOrders" }, { $match: { "subOrders.paymentStatus": "confirme" } }, { $addFields: { paidAt: { $ifNull: ["$subOrders.paymentConfirmedAt", "$createdAt"] } } }, { $match: { paidAt: paidDate } }, { $group: { _id: null, total: { $sum: "$subOrders.payableTotal" }, count: { $sum: 1 } } }]),
    FinancialEntry.aggregate([{ $match: { kind: "refund", createdAt: paidDate } }, { $group: { _id: null, total: { $sum: "$amountMGA" }, count: { $sum: 1 } } }]),
    Subscription.find({ payementStatus: "Completed", cancelAtPeriodEnd: { $ne: true }, endDate: { $gte: now, $lte: new Date(now.getTime() + 30 * 86400000) } }).select("priceMGA endDate").lean(),
    Subscription.aggregate([{ $match: { payementStatus: "Completed" } }, { $addFields: { paidAt: { $ifNull: ["$paymentCompletedAt", "$createdAt"] } } }, { $match: { paidAt: paidDate } }, { $project: { amountMGA: "$priceMGA", createdAt: "$paidAt" } }]),
    MarketplaceOrder.aggregate([{ $unwind: "$subOrders" }, { $match: { "subOrders.paymentStatus": "confirme" } }, { $addFields: { paidAt: { $ifNull: ["$subOrders.paymentConfirmedAt", "$createdAt"] } } }, { $match: { paidAt: paidDate } }, { $project: { amountMGA: "$subOrders.payableTotal", createdAt: "$paidAt" } }]),
  ]);
  const entries = [...subPayments.map((x: any) => ({ date: x.createdAt, amountMGA: x.priceMGA ?? 0, kind: "subscription_payment" })), ...marketPayments.map((x: any) => ({ date: x.createdAt, amountMGA: x.amountMGA ?? 0, kind: "marketplace_payment" }))];
  const byDay: Record<string, number> = {};
  for (const entry of entries) { const day = new Date(entry.date).toISOString().slice(0, 10); byDay[day] = (byDay[day] ?? 0) + Number(entry.amountMGA); }
  res.status(200).json({ status: "Success", data: { period: { from, to }, subscriptionRevenueMGA: subscriptionRevenue[0]?.total ?? 0, marketplacePaymentsMGA: marketplaceRows[0]?.total ?? 0, grossRevenueMGA: (subscriptionRevenue[0]?.total ?? 0) + (marketplaceRows[0]?.total ?? 0), refundsMGA: refunds[0]?.total ?? 0, netRevenueMGA: (subscriptionRevenue[0]?.total ?? 0) + (marketplaceRows[0]?.total ?? 0) - (refunds[0]?.total ?? 0), paymentCount: (subscriptionRevenue[0]?.count ?? 0) + (marketplaceRows[0]?.count ?? 0), refundCount: refunds[0]?.count ?? 0, forecastNext30DaysMGA: upcoming.reduce((sum: number, item: any) => sum + Number(item.priceMGA ?? 0), 0), byDay: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, amountMGA]) => ({ date, amountMGA })), reconciliationNote: "Les nouveaux paiements utilisent leur date de confirmation. Pour les données historiques sans horodatage de paiement, la date de création de la demande/commande sert d’estimation; les remboursements sont tracés depuis leur saisie." } });
});

const recordAdminRefund = expressAsyncHandler(async (req: Request, res: Response) => {
  if (!hasAdminPermission((req as any).user, "finance.refund")) {
    res.status(403).json({ status: "Failed", message: "Permission de remboursement insuffisante." });
    return;
  }
  const { sourceType, sourceId, amountMGA, note } = req.body ?? {};
  if (!["subscription", "marketplace"].includes(sourceType) || typeof sourceId !== "string" || !sourceId.trim() || !Number.isSafeInteger(amountMGA) || amountMGA < 1 || amountMGA > 1000000000 || typeof note !== "string" || note.trim().length < 3 || note.trim().length > 500) { res.status(400).json({ status: "Failed", message: "Informations de remboursement invalides." }); return; }
  const existing = await FinancialEntry.find({ kind: "refund", sourceType, sourceId: sourceId.trim() }).lean();
  let gross = 0; let ownerId: any;
  if (sourceType === "subscription") { const sub: any = await Subscription.findById(sourceId).lean(); if (!sub || sub.payementStatus !== "Completed") { res.status(404).json({ status: "Failed", message: "Encaissement d’abonnement introuvable." }); return; } gross = Number(sub.priceMGA ?? 0); ownerId = sub.owner_id; }
  else { const order: any = await MarketplaceOrder.findOne({ "subOrders._id": sourceId }).lean(); const line = order?.subOrders?.find((x: any) => String(x._id) === sourceId); if (!line || line.paymentStatus !== "confirme") { res.status(404).json({ status: "Failed", message: "Encaissement marketplace introuvable." }); return; } gross = Number(line.payableTotal ?? 0); ownerId = order.owner_id; }
  const alreadyRefunded = existing.reduce((sum: number, item: any) => sum + Number(item.amountMGA), 0);
  if (amountMGA + alreadyRefunded > gross) { res.status(409).json({ status: "Failed", message: "Le total remboursé dépasserait le montant encaissé." }); return; }
  const actor = (req as any).user;
  const entry = await FinancialEntry.create({ kind: "refund", amountMGA, sourceId: sourceId.trim(), sourceType, ownerId, actorId: actor._id, note: note.trim() });
  if (sourceType === "subscription") await Subscription.updateOne({ _id: sourceId }, { $inc: { refundedMGA: amountMGA } });
  await recordAdminAction({ actorId: String(actor._id), actorName: actor.username ?? "Super Admin", action: "finance.refund.recorded", targetType: sourceType, targetId: sourceId, targetLabel: `${amountMGA} MGA`, reason: note.trim(), ip: req.ip });
  res.status(201).json({ status: "Success", message: "Remboursement enregistré dans le registre financier. Effectuez le reversement auprès du moyen de paiement.", data: entry });
});

const getAdminCurrencyRates = expressAsyncHandler(async (req: Request, res: Response) => {
  if (!await requireSuperAdmin(req, res)) return;
  const settings: any = await PlatformSettings.findOne({ key: "default" }).lean();
  res.status(200).json({ status: "Success", data: settings?.currencyRates ?? { EUR: null, USD: null, updatedAt: null } });
});

const updateAdminCurrencyRates = expressAsyncHandler(async (req: Request, res: Response) => {
  if (!await requireSuperAdmin(req, res)) return;
  const EUR = req.body?.EUR; const USD = req.body?.USD;
  if (![EUR, USD].every((value) => Number.isSafeInteger(value) && value >= 1 && value <= 100000000)) { res.status(400).json({ status: "Failed", message: "Saisissez les taux MGA par EUR et par USD en nombres entiers positifs." }); return; }
  const actor = (req as any).user;
  const settings: any = await PlatformSettings.findOneAndUpdate({ key: "default" }, { $set: { currencyRates: { EUR, USD, updatedAt: new Date(), updatedBy: actor._id } } }, { upsert: true, new: true, runValidators: true }).lean();
  await recordAdminAction({ actorId: String(actor._id), actorName: actor.username ?? "Super Admin", action: "platform.currency_rates.updated", targetType: "platform-settings", targetId: "default", targetLabel: "Taux de conversion MGA", ip: req.ip });
  res.status(200).json({ status: "Success", message: "Taux d’affichage enregistrés.", data: settings.currencyRates });
});

const getAdminOperationsOverview = expressAsyncHandler(async (req: Request, res: Response) => {
  if (!await requireSuperAdmin(req, res)) return;
  const now = new Date();
  const [pendingSubscriptions, disputes, pendingKyc, openTickets, overdueTickets, expiringSubscriptions, unverifiedPayments] = await Promise.all([
    Subscription.countDocuments({ payementStatus: "Pending" }),
    MarketplaceOrder.aggregate([{ $unwind: "$subOrders" }, { $match: { "subOrders.status": "litige" } }, { $count: "count" }]),
    PersonnalInfo.countDocuments({ cin: { $exists: true, $ne: "" }, frontImage: { $exists: true, $ne: "" }, backImage: { $exists: true, $ne: "" }, $or: [{ verificationStatus: "pending" }, { verificationStatus: { $exists: false } }] }),
    ContactTicket.countDocuments({ status: { $ne: "resolved" } }),
    ContactTicket.countDocuments({ status: { $ne: "resolved" }, dueAt: { $lt: now } }),
    Subscription.countDocuments({ payementStatus: "Completed", cancelAtPeriodEnd: { $ne: true }, endDate: { $gte: now, $lte: new Date(now.getTime() + 30 * 86400000) } }),
    MarketplaceOrder.countDocuments({ "subOrders.status": "paiement_declare" }),
  ]);
  res.status(200).json({ status: "Success", data: { pendingSubscriptions, openDisputes: disputes[0]?.count ?? 0, pendingKyc, openTickets, overdueTickets, expiringSubscriptions, unverifiedPayments, generatedAt: now } });
});

const getSeller360 = expressAsyncHandler(async (req: Request, res: Response) => {
  if (!await requireSuperAdmin(req, res)) return;
  if (!Types.ObjectId.isValid(req.params.sellerId)) { res.status(400).json({ status: "Failed", message: "Identifiant vendeur invalide." }); return; }
  const shop = await Boutiks.findOne({ $or: [{ _id: req.params.sellerId }, { owner_id: req.params.sellerId }] }).populate("subscription_id").populate("owner_id", "username email phonenumber").lean<any>();
  if (!shop) { res.status(404).json({ status: "Failed", message: "Boutique introuvable." }); return; }
  const [kyc, publicationGroups, recentProducts, orders, audit, subscriptionHistory] = await Promise.all([
    PersonnalInfo.findOne({ owner_id: shop.owner_id?._id ?? shop.owner_id }).select("verificationStatus verificationReason reviewedAt").lean(),
    Product.aggregate([{ $match: { boutiks_id: shop._id } }, { $group: { _id: "$publicationStatus", count: { $sum: 1 } } }]),
    Product.find({ boutiks_id: shop._id }).select("name price stock publicationStatus moderationReason createdAt updatedAt").sort({ createdAt: -1 }).limit(8).lean(),
    MarketplaceOrder.find({ "subOrders.boutiks_id": shop._id }).sort({ createdAt: -1 }).limit(10).select("customer subOrders createdAt").lean(),
    AdminAudit.find({ targetId: String(shop.owner_id?._id ?? shop.owner_id) }).sort({ createdAt: -1 }).limit(20).lean(),
    Subscription.find({ owner_id: shop.owner_id?._id ?? shop.owner_id }).select("plan priceMGA startDate endDate payementStatus lifecycleStatus cancelAtPeriodEnd canceledAt graceUntil autoRenew refundedMGA paymentCompletedAt createdAt").sort({ createdAt: -1 }).limit(6).lean(),
  ]);
  const publications = { total: 0, approved: 0, pending: 0, rejected: 0 };
  for (const row of publicationGroups) {
    const count = Number(row.count) || 0;
    publications.total += count;
    if (row._id === "Approved") publications.approved = count;
    else if (row._id === "Rejected") publications.rejected = count;
    else publications.pending += count;
  }
  const sellerId = String(shop.owner_id?._id ?? shop.owner_id);
  const [role] = await Promise.all([UserGroupMember.findOne({ user_id: sellerId }).populate("usergroup_id").lean<any>()]);
  res.status(200).json({ status: "Success", data: { shop, kyc, productCount: publications.total, publications, recentProducts, subscriptionHistory, orders: orders.map((order: any) => ({ ...order, subOrders: order.subOrders.filter((line: any) => String(line.boutiks_id) === String(shop._id)) })), audit, role: role?.usergroup_id?.name ?? "Boutiks" } });
});

const updateSellerCommission = expressAsyncHandler(async (req: Request, res: Response) => {
  if (!await requireSuperAdmin(req, res)) return;
  const commissionPercent = req.body?.commissionPercent;
  if (!Types.ObjectId.isValid(req.params.sellerId) || !Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 50) { res.status(400).json({ status: "Failed", message: "Commission invalide (0 à 50 %)." }); return; }
  const shop = await Boutiks.findOneAndUpdate({ $or: [{ _id: req.params.sellerId }, { owner_id: req.params.sellerId }] }, { $set: { commissionPercent } }, { new: true }).lean<any>();
  if (!shop) { res.status(404).json({ status: "Failed", message: "Boutique introuvable." }); return; }
  const actor = (req as any).user;
  await recordAdminAction({ actorId: String(actor._id), actorName: actor.username ?? "Super Admin", action: "seller.commission.updated", targetType: "boutik", targetId: String(shop._id), targetLabel: shop.name, reason: `${commissionPercent}%`, ip: req.ip });
  res.status(200).json({ status: "Success", data: { commissionPercent } });
});

const getSellerPayoutReport = expressAsyncHandler(async (req: Request, res: Response) => {
  if (!hasAdminPermission((req as any).user, "finance.read")) {
    res.status(403).json({ status: "Failed", message: "Permission de lecture financière insuffisante." });
    return;
  }
  const shops = await Boutiks.find({}).select("name owner_id commissionPercent payoutStatus payoutReference").lean<any[]>();
  const totals = await MarketplaceOrder.aggregate([{ $unwind: "$subOrders" }, { $match: { "subOrders.paymentStatus": "confirme" } }, { $group: { _id: "$subOrders.boutiks_id", grossMGA: { $sum: "$subOrders.payableTotal" }, commissionMGA: { $sum: { $multiply: ["$subOrders.payableTotal", { $divide: [{ $ifNull: ["$subOrders.commissionPercent", 0] }, 100] }] } } } }]);
  const byShop = new Map(totals.map((row: any) => [String(row._id), row]));
  const paid = await FinancialEntry.aggregate([{ $match: { kind: "seller_payout" } }, { $group: { _id: "$sourceId", paidMGA: { $sum: "$amountMGA" } } }]);
  const paidByShop = new Map(paid.map((row: any) => [String(row._id), row.paidMGA]));
  res.status(200).json({ status: "Success", data: shops.map((shop) => { const row: any = byShop.get(String(shop._id)); const gross = Number(row?.grossMGA ?? 0); const commission = Math.round(Number(row?.commissionMGA ?? 0)); const netDue = Math.max(0, gross - commission); const paidMGA = Number(paidByShop.get(String(shop._id)) ?? 0); return { ...shop, grossMGA: gross, commissionMGA: commission, netDueMGA: netDue, paidMGA, balanceMGA: Math.max(0, netDue - paidMGA) }; }) });
});

const recordSellerPayout = expressAsyncHandler(async (req: Request, res: Response) => {
  if (!hasAdminPermission((req as any).user, "finance.payout")) {
    res.status(403).json({ status: "Failed", message: "Permission de versement insuffisante." });
    return;
  }
  const shopId = req.params.shopId; const amountMGA = req.body?.amountMGA; const reference = typeof req.body?.reference === "string" ? req.body.reference.trim().slice(0, 120) : "";
  if (!Types.ObjectId.isValid(shopId) || !Number.isSafeInteger(amountMGA) || amountMGA < 1 || !reference) { res.status(400).json({ status: "Failed", message: "Montant et référence de versement requis." }); return; }
  const shop: any = await Boutiks.findById(shopId).lean(); if (!shop) { res.status(404).json({ status: "Failed", message: "Boutique introuvable." }); return; }
  const prior = await FinancialEntry.aggregate([{ $match: { kind: "seller_payout", sourceId: shopId } }, { $group: { _id: null, amount: { $sum: "$amountMGA" } } }]);
  const [grossRow] = await MarketplaceOrder.aggregate([{ $unwind: "$subOrders" }, { $match: { "subOrders.boutiks_id": new Types.ObjectId(shopId), "subOrders.paymentStatus": "confirme" } }, { $group: { _id: null, gross: { $sum: "$subOrders.payableTotal" }, commission: { $sum: { $multiply: ["$subOrders.payableTotal", { $divide: [{ $ifNull: ["$subOrders.commissionPercent", 0] }, 100] }] } } } }]);
  const due = Math.max(0, Number(grossRow?.gross ?? 0) - Math.round(Number(grossRow?.commission ?? 0)));
  const alreadyPaid = Number(prior[0]?.amount ?? 0);
  if (amountMGA + alreadyPaid > due) { res.status(409).json({ status: "Failed", message: "Le versement dépasserait le solde vendeur dû." }); return; }
  const actor = (req as any).user;
  const entry = await FinancialEntry.create({ kind: "seller_payout", amountMGA, sourceId: shopId, sourceType: "seller", ownerId: shop.owner_id, actorId: actor._id, note: reference });
  await Boutiks.updateOne({ _id: shopId }, { $set: { payoutStatus: amountMGA + alreadyPaid >= due ? "paid" : "pending", payoutReference: reference } });
  await recordAdminAction({ actorId: String(actor._id), actorName: actor.username ?? "Super Admin", action: "finance.seller_payout.recorded", targetType: "boutik", targetId: shopId, targetLabel: shop.name, reason: `${amountMGA} MGA · ${reference}`, ip: req.ip });
  res.status(201).json({ status: "Success", message: "Versement vendeur consigné. Effectuez le transfert via le moyen convenu.", data: entry });
});

const exportAdminData = expressAsyncHandler(async (req: Request, res: Response) => {
  if (!await requireSuperAdmin(req, res)) return;
  const kind = String(req.query.kind ?? ""); const safeCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;
  const sendCsv = (filename: string, header: string, rows: unknown[][]) => {
    const lines = [header, ...rows.slice(0, 10000).map((row) => row.map(safeCell).join(","))];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=shopinmada-${filename}.csv`);
    res.send(`\uFEFF${lines.join("\n")}`);
  };
  if (kind === "orders") {
    const orders = await MarketplaceOrder.find({}).sort({ createdAt: -1 }).limit(10000).lean<any[]>();
    sendCsv("commandes", "commande,client,tel,boutique,sous_commande,statut,paiement,total_mga,cree_le", orders.flatMap((order) => order.subOrders.map((line: any) => [order._id, order.customer?.name, order.customer?.phone, line.boutiks_id, line._id, line.status, line.paymentStatus, line.payableTotal, order.createdAt])));
    return;
  }
  if (kind === "disputes") {
    const orders = await MarketplaceOrder.find({ "subOrders.status": "litige" }).sort({ createdAt: -1 }).limit(10000).lean<any[]>();
    sendCsv("litiges", "commande,client,tel,boutique,sous_commande,montant,ouvert_le,derniere_note", orders.flatMap((order) => order.subOrders.filter((line: any) => line.status === "litige").map((line: any) => [order._id, order.customer?.name, order.customer?.phone, line.boutiks_id, line._id, line.payableTotal, line.updatedAt ?? order.updatedAt, line.statusHistory?.at(-1)?.note])));
    return;
  }
  if (kind === "sellers") {
    const shops = await Boutiks.find({}).populate("owner_id", "username email phonenumber").sort({ createdAt: -1 }).limit(10000).lean<any[]>();
    sendCsv("vendeurs", "boutique,vendeur,email,telephone,ville,actif,commission_pct", shops.map((shop) => [shop.name, shop.owner_id?.username, shop.owner_id?.email, shop.owner_id?.phonenumber, shop.ville, shop.isActive, shop.commissionPercent]));
    return;
  }
  if (kind === "products") {
    const products = await Product.find({}).select("name category price stock publicationStatus moderationReason createdAt owner_id boutiks_id").populate("owner_id", "username").populate("boutiks_id", "name").sort({ createdAt: -1 }).limit(10000).lean<any[]>();
    sendCsv("produits", "produit,categorie,prix_mga,stock,statut,vendeur,boutique,motif,cree_le", products.map((product) => [product.name, product.category, product.price, product.stock, product.publicationStatus, product.owner_id?.username, product.boutiks_id?.name, product.moderationReason, product.createdAt]));
    return;
  }
  if (kind === "comments") {
    const comments = await Comment.find({}).select("comment moderationStatus verifiedPurchase moderationReason createdAt owner_id product_id").populate("owner_id", "username").populate("product_id", "name").sort({ createdAt: -1 }).limit(10000).lean<any[]>();
    sendCsv("avis", "avis,statut,achat_verifie,auteur,produit,motif,cree_le", comments.map((comment) => [comment.comment, comment.moderationStatus, comment.verifiedPurchase, comment.owner_id?.username, comment.product_id?.name, comment.moderationReason, comment.createdAt]));
    return;
  }
  if (kind === "kyc") {
    const records = await PersonnalInfo.find({ verificationStatus: { $in: ["pending", "approved", "rejected"] } }).select("firstName lastName verificationStatus verificationReason reviewedAt owner_id").populate("owner_id", "username email").sort({ reviewedAt: -1 }).limit(10000).lean<any[]>();
    sendCsv("kyc", "vendeur,email,nom,prenom,statut,motif,revue_le", records.map((record) => [record.owner_id?.username, record.owner_id?.email, record.lastName, record.firstName, record.verificationStatus, record.verificationReason, record.reviewedAt]));
    return;
  }
  if (kind === "tickets") {
    const tickets = await ContactTicket.find({}).select("name email subject status priority createdAt dueAt resolvedAt").sort({ createdAt: -1 }).limit(10000).lean<any[]>();
    sendCsv("tickets-support", "nom,email,sujet,statut,priorite,cree_le,echeance,resolu_le", tickets.map((ticket) => [ticket.name, ticket.email, ticket.subject, ticket.status, ticket.priority, ticket.createdAt, ticket.dueAt, ticket.resolvedAt]));
    return;
  }
  if (kind === "subscriptions") {
    const subscriptions = await Subscription.find({}).select("owner_id plan priceMGA startDate endDate payementStatus lifecycleStatus autoRenew refundedMGA paymentCompletedAt createdAt").populate("owner_id", "username email").sort({ createdAt: -1 }).limit(10000).lean<any[]>();
    sendCsv("abonnements", "client,email,forfait,prix_mga,debut,fin,statut_paiement,statut,renouvellement_auto,rembourse_mga,paye_le", subscriptions.map((subscription) => [subscription.owner_id?.username, subscription.owner_id?.email, subscription.plan, subscription.priceMGA, subscription.startDate, subscription.endDate, subscription.payementStatus, subscription.lifecycleStatus, subscription.autoRenew, subscription.refundedMGA, subscription.paymentCompletedAt]));
    return;
  }
  if (kind === "audit") {
    const actions = await AdminAudit.find({}).select("actorName action targetType targetId targetLabel reason createdAt").sort({ createdAt: -1 }).limit(10000).lean<any[]>();
    sendCsv("audit-admin", "acteur,action,type_cible,id_cible,cible,motif,cree_le", actions.map((action) => [action.actorName, action.action, action.targetType, action.targetId, action.targetLabel, action.reason, action.createdAt]));
    return;
  }
  res.status(400).json({ status: "Failed", message: "Type d’export invalide." });
});

const listAdminStaff = expressAsyncHandler(async (req: Request, res: Response) => {
  if (!await requireSuperAdmin(req, res)) return;
  const groups = await UserGroup.find({ name: { $in: ["Support", "Moderator", "Finance", "Read Only"] } }).select("_id name").lean<any[]>();
  const groupById = new Map(groups.map((group) => [String(group._id), group.name]));
  const rows = await UserGroupMember.find({ usergroup_id: { $in: groups.map((group) => group._id) } }).populate("user_id", "username email").lean<any[]>();
  res.status(200).json({ status: "Success", data: rows.map((row) => ({ userId: row.user_id?._id, username: row.user_id?.username, email: row.user_id?.email, role: groupById.get(String(row.usergroup_id)), permissions: row.adminPermissions ?? [] })) });
});

const setAdminStaffRole = expressAsyncHandler(async (req: Request, res: Response) => {
  if (!await requireSuperAdmin(req, res)) return;
  const { role, permissions } = req.body ?? {};
  const rolePermissions: Record<string, string[]> = { Support: ["support.read", "support.reply", "support.manage"], Moderator: ["moderation.review"], Finance: ["finance.read", "finance.refund", "finance.payout"], "Read Only": ["support.read", "finance.read"] };
  if (!Types.ObjectId.isValid(req.params.userId) || !(role in rolePermissions) || !Array.isArray(permissions) || permissions.some((permission: unknown) => typeof permission !== "string" || !rolePermissions[role].includes(permission))) { res.status(400).json({ status: "Failed", message: "Rôle ou permissions invalides." }); return; }
  const target = await getUser(req.params.userId); if (!target) { res.status(404).json({ status: "Failed", message: "Compte introuvable." }); return; }
  const group = await (await import("../model/userGroup.model")).default.findOneAndUpdate({ name: role }, { $setOnInsert: { name: role } }, { upsert: true, new: true });
  const member = await UserGroupMember.findOneAndUpdate({ user_id: req.params.userId }, { $set: { usergroup_id: group._id, adminPermissions: permissions } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  await (await import("../model/user.model")).default.findByIdAndUpdate(req.params.userId, { $set: { userGroupMember_id: member._id } });
  const actor = (req as any).user; await recordAdminAction({ actorId: String(actor._id), actorName: actor.username ?? "Super Admin", action: "admin_staff.role.assigned", targetType: "user", targetId: req.params.userId, targetLabel: target.username, reason: `${role}: ${permissions.join(",")}`, ip: req.ip });
  res.status(200).json({ status: "Success", data: { userId: req.params.userId, role, permissions } });
});

export { listAdminAudit, listAdminCategories, createAdminCategory, listAdminPlans, updateAdminPlan, getSellerEntitlements, startSellerImpersonation, stopSellerImpersonation, getFinancialReport, recordAdminRefund, getAdminCurrencyRates, updateAdminCurrencyRates, getAdminOperationsOverview, getSeller360, updateSellerCommission, getSellerPayoutReport, recordSellerPayout, exportAdminData, listAdminStaff, setAdminStaffRole, requestAdminStepUp, verifyAdminStepUp };
