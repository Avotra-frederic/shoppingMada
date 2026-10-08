import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { Types } from "mongoose";
import {
  createNewSubscription,
  findSubscription,
  getBoutiksSubscription,
  getSubscription,
  updateSubscription,
} from "../service/subscription.service";
import { updateBoutiks } from "../service/boutiks.service";
import { recordAdminAction } from "../service/admin-audit.service";
import IUser from "../interface/user.interface";
import IBoutiks from "../interface/boutiks.interface";
import sendEmail from "../helpers/mail";
import {
  findActiveSubscriptionPaymentMethod,
  getSubscriptionPaymentMethods,
  saveSubscriptionPaymentMethods,
} from "../service/subscription-payment-method.service";
import { SubscriptionPaymentMethod } from "../interface/subscription-payment-method.interface";
import SubscriptionPlan from "../model/subscription-plan.model";
import FinancialEntry from "../model/financial-entry.model";
import Subscription from "../model/abonnement.model";
import AdminAudit from "../model/admin-audit.model";

const roleOf = (user: any): string | undefined =>
  user?.userGroupMember_id?.usergroup_id?.name;

const sendNewSubscription = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.boutiks_id) {
    res.status(403).json({ status: "Failed", message: "Une boutique est requise pour souscrire." });
    return;
  }

  const { plan = "Pro", transactionPhoneNumber, refTransaction, paymentMethodId } = req.body;
  if (![transactionPhoneNumber, refTransaction, paymentMethodId].every((value) => typeof value === "string" && value.trim())) {
    res.status(400).json({ status: "Failed", message: "Les informations de paiement sont incomplètes." });
    return;
  }
  const paymentMethod = await findActiveSubscriptionPaymentMethod(paymentMethodId);
  if (!paymentMethod) {
    res.status(400).json({ status: "Failed", message: "Ce moyen de paiement n’est plus disponible." });
    return;
  }
  const paymentConfiguration = await getSubscriptionPaymentMethods(true);
  const planConfiguration: any = await SubscriptionPlan.findOne({ key: String(plan).toLowerCase(), active: true }).lean();
  const subscription = await createNewSubscription({
    plan: String(plan).slice(0, 80),
    transactionPhoneNumber: String(transactionPhoneNumber).trim().slice(0, 40),
    refTransaction: String(refTransaction).trim().slice(0, 120),
    selectedPhoneNumber: paymentMethod.accountNumber,
    paymentMethodId: String(paymentMethod._id),
    paymentMethodName: paymentMethod.name,
    paymentAccountName: paymentMethod.accountName,
    paymentAccountNumber: paymentMethod.accountNumber,
    paymentInstructions: paymentMethod.instructions,
    priceMGA: Number(planConfiguration?.monthlyPriceMGA) > 0 ? planConfiguration.monthlyPriceMGA : paymentConfiguration.monthlyPriceMGA,
    owner_id: user._id,
    payementStatus: "Pending",
  } as any);
  if (!subscription) {
    res.status(400).json({ status: "Failed", message: "Impossible de créer la demande." });
    return;
  }
  res.status(201).json({ status: "Success", message: "Votre demande a été envoyée." });
});

const getSubscriptionPaymentOptions = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (roleOf(user) === "Super Admin") {
    const settings = await getSubscriptionPaymentMethods();
    const pro: any = await SubscriptionPlan.findOne({ key: "pro" }).lean();
    res.status(200).json({ status: "Success", data: { ...settings, monthlyPriceMGA: Number(pro?.monthlyPriceMGA) > 0 ? pro.monthlyPriceMGA : settings.monthlyPriceMGA } });
    return;
  }
  if (!user?.boutiks_id || roleOf(user) !== "Boutiks") {
    res.status(403).json({ status: "Failed", message: "Seules les boutiques peuvent consulter les moyens de paiement d’abonnement." });
    return;
  }
  const settings = await getSubscriptionPaymentMethods(true);
  const pro: any = await SubscriptionPlan.findOne({ key: "pro", active: true }).lean();
  res.status(200).json({ status: "Success", data: { ...settings, monthlyPriceMGA: Number(pro?.monthlyPriceMGA) > 0 ? pro.monthlyPriceMGA : settings.monthlyPriceMGA } });
});

const listPublicSubscriptionPlans = expressAsyncHandler(async (_req: Request, res: Response) => {
  const plans = await SubscriptionPlan.find({ active: true }).select("key name monthlyPriceMGA durationDays maxProducts features").sort({ monthlyPriceMGA: 1 }).lean();
  const paymentSettings = await getSubscriptionPaymentMethods();
  const data = plans.map((plan) => ({
    key: plan.key,
    name: plan.name,
    monthlyPriceMGA: plan.key === "pro" && Number(plan.monthlyPriceMGA) <= 0 ? paymentSettings.monthlyPriceMGA : plan.monthlyPriceMGA,
    durationDays: plan.durationDays,
    maxProducts: plan.maxProducts,
    features: plan.features,
  }));
  res.status(200).json({ status: "Success", data });
});

const updateSubscriptionPaymentOptions = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (roleOf(user) !== "Super Admin") {
    res.status(403).json({ status: "Failed", message: "Accès réservé au Super Admin." });
    return;
  }
  const { methods: submittedMethods, monthlyPriceMGA } = req.body;
  if (!Array.isArray(submittedMethods) || submittedMethods.length > 20) {
    res.status(400).json({ status: "Failed", message: "La liste des moyens de paiement est invalide." });
    return;
  }
  if (!Number.isSafeInteger(monthlyPriceMGA) || monthlyPriceMGA < 0 || monthlyPriceMGA > 1000000000) {
    res.status(400).json({ status: "Failed", message: "Le tarif mensuel en MGA est invalide." });
    return;
  }
  const methods: SubscriptionPaymentMethod[] = [];
  for (const method of submittedMethods) {
    if (
      !method ||
      typeof method.name !== "string" || !method.name.trim() ||
      typeof method.accountName !== "string" || !method.accountName.trim() ||
      typeof method.accountNumber !== "string" || !method.accountNumber.trim() ||
      typeof method.instructions !== "string" ||
      typeof method.isActive !== "boolean" ||
      (method._id !== undefined && !Types.ObjectId.isValid(method._id))
    ) {
      res.status(400).json({ status: "Failed", message: "Chaque moyen doit avoir un nom, un titulaire, un numéro et un statut valides." });
      return;
    }
    methods.push({
      ...(method._id ? { _id: method._id } : {}),
      name: method.name.trim().slice(0, 80),
      accountName: method.accountName.trim().slice(0, 120),
      accountNumber: method.accountNumber.trim().slice(0, 40),
      instructions: method.instructions.trim().slice(0, 500),
      isActive: method.isActive,
    });
  }
  const saved = await saveSubscriptionPaymentMethods(methods, monthlyPriceMGA);
  await SubscriptionPlan.updateOne({ key: "pro" }, { $set: { key: "pro", name: "Pro", monthlyPriceMGA } }, { upsert: true, setDefaultsOnInsert: true });
  res.status(200).json({ status: "Success", message: "Les moyens de paiement ont été enregistrés.", data: saved });
});

const updateNewSubscription = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;
  const subscription = await findSubscription(id);
  if (!subscription) {
    res.status(404).json({ status: "Failed", message: "Demande introuvable." });
    return;
  }
  const isAdmin = roleOf(user) === "Super Admin";
  const isOwner = String((subscription.owner_id as any)?._id ?? subscription.owner_id) === String(user._id);
  if (!isAdmin && !isOwner) {
    res.status(403).json({ status: "Failed", message: "Accès refusé." });
    return;
  }

  const { payementStatus, motif, startDate, endDate } = req.body;
  if (!isAdmin && (payementStatus !== "Canceled" || subscription.payementStatus !== "Pending")) {
    res.status(403).json({ status: "Failed", message: "Vous pouvez uniquement annuler une demande en attente." });
    return;
  }
  if (isAdmin && !["Completed", "Rejected"].includes(payementStatus)) {
    res.status(400).json({ status: "Failed", message: "État de paiement invalide." });
    return;
  }
  if (subscription.payementStatus !== "Pending") {
    res.status(409).json({ status: "Failed", message: "Cette demande a déjà été traitée." });
    return;
  }
  const now = new Date();
  const planConfig: any = payementStatus === "Completed" ? await SubscriptionPlan.findOne({ key: String(subscription.plan).toLowerCase() }).lean() : null;
  const currentActive: any = payementStatus === "Completed" ? await Subscription.findOne({ owner_id: subscription.owner_id, payementStatus: "Completed", endDate: { $gt: now }, _id: { $ne: subscription._id } }).sort({ endDate: -1 }).lean() : null;
  const effectiveStart = currentActive?.endDate && new Date(currentActive.endDate).getTime() > now.getTime() ? new Date(currentActive.endDate) : now;
  const durationDays = Math.min(366, Math.max(1, Number(planConfig?.durationDays ?? 30)));
  const update = payementStatus === "Completed"
    ? { payementStatus, lifecycleStatus: "active", paymentCompletedAt: now, cancelAtPeriodEnd: false, canceledAt: undefined, graceUntil: undefined, autoRenew: false, startDate: effectiveStart, endDate: new Date(effectiveStart.getTime() + durationDays * 86400000) }
    : { payementStatus, ...(payementStatus === "Rejected" && motif ? { motif: String(motif).slice(0, 500) } : {}) };
  const updated = await updateSubscription(update as any, id);
  if (!updated) {
    res.status(400).json({ status: "Failed", message: "Impossible de mettre à jour la demande." });
    return;
  }

  if (isAdmin) {
    await recordAdminAction({ actorId: String(user._id), actorName: user.username ?? "Super Admin", action: `subscription.${payementStatus.toLowerCase()}`, targetType: "subscription", targetId: String(updated._id), targetLabel: String(updated.refTransaction ?? updated._id), reason: String(motif ?? "").slice(0, 500), ip: req.ip });
  }

  if (payementStatus === "Completed") {
    const owner = updated.owner_id as IUser;
    const boutikId = (owner?.boutiks_id as any)?._id ?? owner?.boutiks_id;
    const boutik = boutikId && await updateBoutiks(String(boutikId), {
      subscription_id: new Types.ObjectId(String(updated._id)), plan: "pro",
    } as IBoutiks);
    if (!boutik) {
      res.status(500).json({ status: "Failed", message: "La demande est validée, mais l’activation de la boutique a échoué." });
      return;
    }
    await FinancialEntry.updateOne({ kind: "subscription_payment", sourceId: String(updated._id) }, { $setOnInsert: { kind: "subscription_payment", sourceId: String(updated._id), sourceType: "subscription", amountMGA: Number(updated.priceMGA ?? 0), ownerId: owner?._id } }, { upsert: true });
  }

  if (isAdmin && payementStatus !== "Canceled") {
    const email = {
      title: "Mise à jour de votre abonnement",
      message: payementStatus === "Completed" ? "Votre abonnement a été accepté." : "Votre demande a été refusée.",
      information: motif ? `Motif : ${String(motif).slice(0, 500)}` : "",
      content: "Connectez-vous à votre espace vendeur pour consulter votre abonnement.",
    };
    const owner = updated.owner_id as IUser;
    if (owner?.email) await sendEmail(email, owner.email, "Mise à jour de votre abonnement");
  }
  res.status(200).json({ status: "Success", message: "Demande mise à jour." });
});

const getSubscriptionList = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;
  if (id) {
    const subscription = await findSubscription(id);
    if (!subscription) {
      res.status(404).json({ status: "Failed", message: "Abonnement introuvable." });
      return;
    }
    const isOwner = String((subscription.owner_id as any)?._id ?? subscription.owner_id) === String(user._id);
    if (!isOwner && roleOf(user) !== "Super Admin") {
      res.status(403).json({ status: "Failed", message: "Accès refusé." });
      return;
    }
    res.status(200).json({ status: "Success", data: subscription });
    return;
  }
  if (roleOf(user) === "Super Admin") {
    if (req.query.page || req.query.limit || req.query.status || req.query.q) {
      const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20));
      const filter: any = {};
      if (typeof req.query.status === "string" && ["Pending", "Completed", "Rejected", "Canceled"].includes(req.query.status)) filter.payementStatus = req.query.status;
      if (typeof req.query.q === "string" && req.query.q.trim()) {
        const safe = req.query.q.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const UserModel = (await import("../model/user.model")).default;
        const [users, shops] = await Promise.all([UserModel.find({ $or: [{ username: { $regex: safe, $options: "i" } }, { email: { $regex: safe, $options: "i" } }] }).distinct("_id"), (await import("../model/boutiks.model")).default.find({ name: { $regex: safe, $options: "i" } }).distinct("owner_id")]);
        filter.$or = [{ refTransaction: { $regex: safe, $options: "i" } }, { owner_id: { $in: [...users, ...shops] } }];
      }
      const [data, total, counts] = await Promise.all([Subscription.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().populate({ path: "owner_id", populate: { path: "boutiks_id" } }), Subscription.countDocuments(filter), Subscription.aggregate([{ $group: { _id: "$payementStatus", count: { $sum: 1 } } }])]);
      res.status(200).json({ status: "Success", data, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, stats: Object.fromEntries(counts.map((item: any) => [item._id, item.count])) });
      return;
    }
    res.status(200).json({ status: "Success", data: await getSubscription() });
    return;
  }
  if (user.boutiks_id) {
    res.status(200).json({ status: "Success", data: await getBoutiksSubscription(String(user._id)) });
    return;
  }
  res.status(403).json({ status: "Failed", message: "Accès refusé." });
});

const cancelCurrentSubscription = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const subscription = await findSubscription(req.params.id);
  if (!subscription) { res.status(404).json({ status: "Failed", message: "Abonnement introuvable." }); return; }
  if (String((subscription.owner_id as any)?._id ?? subscription.owner_id) !== String(user._id)) { res.status(403).json({ status: "Failed", message: "Accès refusé." }); return; }
  if (subscription.payementStatus !== "Completed" || !(subscription.endDate && new Date(subscription.endDate).getTime() > Date.now())) { res.status(409).json({ status: "Failed", message: "Aucun abonnement actif à résilier." }); return; }
  const updated = await Subscription.findOneAndUpdate({ _id: req.params.id, cancelAtPeriodEnd: { $ne: true } }, { $set: { cancelAtPeriodEnd: true, canceledAt: new Date(), autoRenew: false } }, { new: true }).lean();
  res.status(updated ? 200 : 409).json({ status: updated ? "Success" : "Failed", message: updated ? "Résiliation programmée à la fin de la période payée." : "La résiliation est déjà programmée.", data: updated });
});

const recordSubscriptionRefund = expressAsyncHandler(async (req: Request, res: Response) => {
  const actor = (req as any).user;
  if (roleOf(actor) !== "Super Admin") { res.status(403).json({ status: "Failed", message: "Accès réservé au Super Admin." }); return; }
  const amountMGA = req.body?.amountMGA; const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
  const sub: any = await Subscription.findById(req.params.id).lean();
  if (!sub || sub.payementStatus !== "Completed" || !Number.isSafeInteger(amountMGA) || amountMGA < 1 || amountMGA > Number(sub.priceMGA ?? 0) - Number(sub.refundedMGA ?? 0) || note.length < 3 || note.length > 500) { res.status(400).json({ status: "Failed", message: "Montant, motif ou abonnement invalide." }); return; }
  const entry = await FinancialEntry.create({ kind: "refund", sourceId: String(sub._id), sourceType: "subscription", amountMGA, ownerId: sub.owner_id, actorId: actor._id, note });
  await Subscription.updateOne({ _id: sub._id }, { $inc: { refundedMGA: amountMGA } });
  await AdminAudit.create({ actorId: actor._id, actorName: actor.username, action: "finance.refund.recorded", targetType: "subscription", targetId: String(sub._id), targetLabel: `${amountMGA} MGA`, reason: note, ip: req.ip });
  res.status(201).json({ status: "Success", message: "Remboursement enregistré. Effectuez le reversement auprès du moyen de paiement.", data: entry });
});

const processSubscriptionLifecycle = async () => {
  const now = new Date();
  const expiring = await Subscription.find({ payementStatus: "Completed", endDate: { $lte: now }, lifecycleStatus: { $nin: ["expired", "canceled"] } }).limit(500).lean<any[]>();
  for (const subscription of expiring) {
    const plan: any = await SubscriptionPlan.findOne({ key: String(subscription.plan).toLowerCase() }).lean();
    const graceUntil = new Date(new Date(subscription.endDate).getTime() + Math.min(30, Math.max(0, Number(plan?.graceDays ?? 3))) * 86400000);
    const lifecycleStatus = subscription.cancelAtPeriodEnd ? "canceled" : now < graceUntil ? "grace" : "expired";
    await Subscription.updateOne({ _id: subscription._id, endDate: subscription.endDate, lifecycleStatus: { $nin: ["expired", "canceled"] } }, { $set: { lifecycleStatus, graceUntil } });
    if (lifecycleStatus === "expired" || lifecycleStatus === "canceled") {
      const UserModel = (await import("../model/user.model")).default;
      const owner: any = await UserModel.findById(subscription.owner_id).select("boutiks_id").lean();
      if (owner?.boutiks_id) await updateBoutiks(String(owner.boutiks_id), { plan: "free", subscription_id: undefined } as any);
    }
  }
  await Subscription.updateMany({ payementStatus: "Completed", cancelAtPeriodEnd: true, endDate: { $lte: now }, lifecycleStatus: { $nin: ["expired", "canceled"] } }, { $set: { lifecycleStatus: "canceled" } });
};

export {
  sendNewSubscription,
  updateNewSubscription,
  getSubscriptionList,
  getSubscriptionPaymentOptions,
  listPublicSubscriptionPlans,
  updateSubscriptionPaymentOptions,
  cancelCurrentSubscription,
  recordSubscriptionRefund,
  processSubscriptionLifecycle,
};
