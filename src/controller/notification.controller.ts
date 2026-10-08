import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { Types } from "mongoose";
import Notification from "../model/notification.model";
import PlatformSettings from "../model/platform-settings.model";
import User from "../model/user.model";

const listNotifications = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20));
  const filter = { recipientId: new Types.ObjectId(String(user._id)) };
  const [data, total, unread] = await Promise.all([Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Notification.countDocuments(filter), Notification.countDocuments({ ...filter, readAt: null })]);
  res.status(200).json({ status: "Success", data, unread, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

const markNotificationRead = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const notification = await Notification.findOneAndUpdate({ _id: req.params.id, recipientId: user._id }, { $set: { readAt: new Date() } }, { new: true }).lean();
  if (!notification) { res.status(404).json({ status: "Failed", message: "Notification introuvable." }); return; }
  res.status(200).json({ status: "Success", data: notification });
});

const updateUserPreferences = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user; const body = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (body.currency !== undefined) {
    if (!(["MGA", "EUR", "USD"].includes(body.currency))) {
      res.status(400).json({ status: "Failed", message: "Devise invalide." }); return;
    }
    updates["preferences.currency"] = body.currency;
  }
  if (body.language !== undefined) {
    if (!(["fr", "en"].includes(body.language))) {
      res.status(400).json({ status: "Failed", message: "Langue invalide." }); return;
    }
    updates["preferences.language"] = body.language;
  }
  if (body.notifications !== undefined) {
    if (!body.notifications || ["orders", "support", "promotions"].some((key) => typeof body.notifications[key] !== "boolean")) {
      res.status(400).json({ status: "Failed", message: "Préférences de notification invalides." }); return;
    }
    for (const key of ["orders", "support", "promotions"]) updates[`preferences.notifications.${key}`] = body.notifications[key];
  }
  if (!Object.keys(updates).length) {
    res.status(400).json({ status: "Failed", message: "Préférences invalides." }); return;
  }
  const updated = await User.findByIdAndUpdate(user._id, { $set: updates }, { new: true, runValidators: true }).select("preferences");
  if (!updated) { res.status(500).json({ status: "Failed", message: "Impossible d’enregistrer les préférences." }); return; }
  res.status(200).json({ status: "Success", message: "Préférences enregistrées.", data: updated.preferences });
});

const getCurrencyRates = expressAsyncHandler(async (_req: Request, res: Response) => {
  const settings: any = await PlatformSettings.findOne({ key: "default" }).select("currencyRates").lean();
  const rates = settings?.currencyRates;
  const fresh = Boolean(rates?.updatedAt && Date.now() - new Date(rates.updatedAt).getTime() <= 7 * 86400000);
  res.status(200).json({ status: "Success", data: { EUR: fresh ? rates.EUR : null, USD: fresh ? rates.USD : null, updatedAt: fresh ? rates.updatedAt : null, fresh } });
});

const getSavedAddresses = expressAsyncHandler(async (req: Request, res: Response) => {
  const user: any = await User.findById((req as any).user._id).select("savedAddresses").lean();
  res.status(200).json({ status: "Success", data: user?.savedAddresses ?? [] });
});

const addSavedAddress = expressAsyncHandler(async (req: Request, res: Response) => {
  const body = req.body ?? {}; const fields = [body.recipientName, body.phone, body.address];
  if (!fields.every((x) => typeof x === "string") || body.recipientName.trim().length < 2 || body.recipientName.length > 120 || body.phone.trim().length < 6 || body.phone.length > 40 || body.address.trim().length < 5 || body.address.length > 300 || (body.city !== undefined && (typeof body.city !== "string" || body.city.length > 100)) || (body.label !== undefined && (typeof body.label !== "string" || body.label.length > 40))) { res.status(400).json({ status: "Failed", message: "Adresse ou coordonnées invalides." }); return; }
  const user: any = await User.findByIdAndUpdate((req as any).user._id, { $push: { savedAddresses: { label: String(body.label ?? "").trim(), recipientName: body.recipientName.trim(), phone: body.phone.trim(), address: body.address.trim(), city: String(body.city ?? "").trim() } } }, { new: true, runValidators: true }).select("savedAddresses").lean();
  res.status(201).json({ status: "Success", data: user?.savedAddresses ?? [] });
});

const deleteSavedAddress = expressAsyncHandler(async (req: Request, res: Response) => {
  const user: any = await User.findByIdAndUpdate((req as any).user._id, { $pull: { savedAddresses: { _id: req.params.id } } }, { new: true }).select("savedAddresses").lean();
  res.status(200).json({ status: "Success", data: user?.savedAddresses ?? [] });
});

export { listNotifications, markNotificationRead, updateUserPreferences, getCurrencyRates, getSavedAddresses, addSavedAddress, deleteSavedAddress };
