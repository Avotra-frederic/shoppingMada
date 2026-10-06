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
import IUser from "../interface/user.interface";
import IBoutiks from "../interface/boutiks.interface";
import sendEmail from "../helpers/mail";
import {
  findActiveSubscriptionPaymentMethod,
  getSubscriptionPaymentMethods,
  saveSubscriptionPaymentMethods,
} from "../service/subscription-payment-method.service";
import { SubscriptionPaymentMethod } from "../interface/subscription-payment-method.interface";

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
    priceMGA: paymentConfiguration.monthlyPriceMGA,
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
    res.status(200).json({ status: "Success", data: await getSubscriptionPaymentMethods() });
    return;
  }
  if (!user?.boutiks_id || roleOf(user) !== "Boutiks") {
    res.status(403).json({ status: "Failed", message: "Seules les boutiques peuvent consulter les moyens de paiement d’abonnement." });
    return;
  }
  res.status(200).json({ status: "Success", data: await getSubscriptionPaymentMethods(true) });
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
  const update = payementStatus === "Completed"
    ? { payementStatus, startDate: startDate ? new Date(startDate) : now, endDate: endDate ? new Date(endDate) : new Date(now.getTime() + 30 * 86400000) }
    : { payementStatus, ...(payementStatus === "Rejected" && motif ? { motif: String(motif).slice(0, 500) } : {}) };
  const updated = await updateSubscription(update as any, id);
  if (!updated) {
    res.status(400).json({ status: "Failed", message: "Impossible de mettre à jour la demande." });
    return;
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
    res.status(200).json({ status: "Success", data: await getSubscription() });
    return;
  }
  if (user.boutiks_id) {
    res.status(200).json({ status: "Success", data: await getBoutiksSubscription(String(user._id)) });
    return;
  }
  res.status(403).json({ status: "Failed", message: "Accès refusé." });
});

export {
  sendNewSubscription,
  updateNewSubscription,
  getSubscriptionList,
  getSubscriptionPaymentOptions,
  updateSubscriptionPaymentOptions,
};
