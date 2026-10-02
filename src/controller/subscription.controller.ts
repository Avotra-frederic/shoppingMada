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

const roleOf = (user: any): string | undefined =>
  user?.userGroupMember_id?.usergroup_id?.name;

const sendNewSubscription = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.boutiks_id) {
    res.status(403).json({ status: "Failed", message: "Une boutique est requise pour souscrire." });
    return;
  }

  const { plan, transactionPhoneNumber, refTransaction, selectedPhoneNumber } = req.body;
  if (![plan, transactionPhoneNumber, refTransaction, selectedPhoneNumber].every((value) => typeof value === "string" && value.trim())) {
    res.status(400).json({ status: "Failed", message: "Les informations de paiement sont incomplètes." });
    return;
  }
  const subscription = await createNewSubscription({
    plan, transactionPhoneNumber, refTransaction, selectedPhoneNumber,
    owner_id: user._id,
    payementStatus: "Pending",
  } as any);
  if (!subscription) {
    res.status(400).json({ status: "Failed", message: "Impossible de créer la demande." });
    return;
  }
  res.status(201).json({ status: "Success", message: "Votre demande a été envoyée." });
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

export { sendNewSubscription, updateNewSubscription, getSubscriptionList };
