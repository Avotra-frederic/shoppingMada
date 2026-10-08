import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { sendContactEmail, sendSupportReply } from "../helpers/mail";
import ContactTicket from "../model/contact-ticket.model";
import AdminAudit from "../model/admin-audit.model";
import { Types } from "mongoose";
import { get_user_group_name } from "../service/user_group_member.service";
import { notifyUserIfEnabled } from "../service/notification.service";
import { hasAdminPermission } from "../service/admin-permissions.service";

const recentContactRequests = new Map<string, { count: number; expiresAt: number }>();
const contactWindowMs = 15 * 60 * 1000;
const maxContactRequests = 5;

const submitContactMessage = expressAsyncHandler(async (req: Request, res: Response) => {
  const { name, email, subject, message } = req.body ?? {};
  if (![name, email, subject, message].every((value) => typeof value === "string")) {
    res.status(400).json({ status: "Failed", message: "Tous les champs sont obligatoires." });
    return;
  }

  const safeName = name.trim();
  const safeEmail = email.trim().toLowerCase();
  const safeSubject = subject.trim();
  const safeMessage = message.trim();
  const priority = /paiement|fraude|pirat|urgent|litige/i.test(`${safeSubject} ${safeMessage}`) ? "high" : "normal";
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (
    safeName.length < 2 || safeName.length > 120 || /[\r\n]/.test(safeName) ||
    safeEmail.length > 254 || !emailPattern.test(safeEmail) || /[\r\n]/.test(safeEmail) ||
    safeSubject.length < 3 || safeSubject.length > 160 || /[\r\n]/.test(safeSubject) ||
    safeMessage.length < 10 || safeMessage.length > 4000
  ) {
    res.status(400).json({ status: "Failed", message: "Vérifiez le nom, l’adresse e-mail, le sujet et le contenu du message." });
    return;
  }

  const now = Date.now();
  const currentLimit = recentContactRequests.get(safeEmail);
  if (currentLimit && currentLimit.expiresAt > now && currentLimit.count >= maxContactRequests) {
    res.status(429).json({ status: "Failed", message: "Trop de messages ont été envoyés depuis cette adresse. Réessayez plus tard." });
    return;
  }
  if (recentContactRequests.size >= 1000 && !currentLimit) {
    for (const [key, limit] of recentContactRequests) {
      if (limit.expiresAt <= now) recentContactRequests.delete(key);
    }
    if (recentContactRequests.size >= 1000) {
      res.status(429).json({ status: "Failed", message: "Le service de contact reçoit trop de demandes. Réessayez plus tard." });
      return;
    }
  }
  recentContactRequests.set(safeEmail, {
    count: currentLimit && currentLimit.expiresAt > now ? currentLimit.count + 1 : 1,
    expiresAt: currentLimit && currentLimit.expiresAt > now ? currentLimit.expiresAt : now + contactWindowMs,
  });

  let ticket: any;
  try {
    ticket = await ContactTicket.create({ name: safeName, email: safeEmail, subject: safeSubject, message: safeMessage, ownerId: (req as any).user?._id, priority, dueAt: new Date(Date.now() + (priority === "high" ? 4 : 24) * 3600000) });
  } catch (error) {
    console.error("Contact ticket persistence failed", error);
    res.status(503).json({ status: "Failed", message: "Le service de contact est temporairement indisponible. Réessayez plus tard." });
    return;
  }
  try {
    await sendContactEmail(safeName, safeEmail, safeSubject, safeMessage);
  } catch (error) {
    const mailError = error as NodeJS.ErrnoException & { responseCode?: number };
    console.error("Contact email delivery failed", { code: mailError.code, responseCode: mailError.responseCode });
  }
  res.status(201).json({ status: "Success", message: "Votre demande a été enregistrée. Notre équipe vous répondra dès que possible.", ticketId: ticket._id });
});

const listContactTickets = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!hasAdminPermission(user, "support.read")) {
    res.status(403).json({ status: "Failed", message: "Accès réservé au Super Admin." }); return;
  }
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  if (status && !["open", "in_progress", "resolved"].includes(status)) {
    res.status(400).json({ status: "Failed", message: "Filtre de ticket invalide." }); return;
  }
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20));
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter: any = { ...(status ? { status } : {}), ...(search ? { $or: [{ name: { $regex: safeSearch, $options: "i" } }, { email: { $regex: safeSearch, $options: "i" } }, { subject: { $regex: safeSearch, $options: "i" } }] } : {}) };
  const [data, total] = await Promise.all([
    ContactTicket.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ContactTicket.countDocuments(filter),
  ]);
  res.status(200).json({ status: "Success", data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

const updateContactTicket = expressAsyncHandler(async (req: Request, res: Response) => {
  const actor = (req as any).user;
  if (!hasAdminPermission(actor, "support.manage")) {
    res.status(403).json({ status: "Failed", message: "Accès réservé au Super Admin." }); return;
  }
  const { status, adminNote, priority } = req.body ?? {};
  if (!(["open", "in_progress", "resolved"].includes(status)) || (adminNote !== undefined && (typeof adminNote !== "string" || adminNote.length > 1000)) || (priority !== undefined && !["low", "normal", "high", "urgent"].includes(priority))) {
    res.status(400).json({ status: "Failed", message: "Mise à jour du ticket invalide." }); return;
  }
  const ticket: any = await ContactTicket.findByIdAndUpdate(req.params.id, {
    $set: { status, ...(priority ? { priority } : {}), ...(adminNote !== undefined ? { adminNote: adminNote.trim() } : {}), assignedTo: actor._id, resolvedAt: status === "resolved" ? new Date() : null },
  }, { new: true, runValidators: true }).lean();
  if (!ticket) { res.status(404).json({ status: "Failed", message: "Ticket introuvable." }); return; }
  await AdminAudit.create({ actorId: actor._id, actorName: actor.username, action: `contact.${status}`, targetType: "contact-ticket", targetId: String(ticket._id), targetLabel: ticket.subject, reason: typeof adminNote === "string" ? adminNote.trim() : "", ip: req.ip });
  res.status(200).json({ status: "Success", message: "Ticket mis à jour.", data: ticket });
});

const replyToContactTicket = expressAsyncHandler(async (req: Request, res: Response) => {
  const actor = (req as any).user;
  if (!hasAdminPermission(actor, "support.reply")) {
    res.status(403).json({ status: "Failed", message: "Accès réservé au Super Admin." }); return;
  }
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (message.length < 2 || message.length > 4000) {
    res.status(400).json({ status: "Failed", message: "La réponse doit contenir entre 2 et 4 000 caractères." }); return;
  }
  const ticket = await ContactTicket.findById(req.params.id);
  if (!ticket) { res.status(404).json({ status: "Failed", message: "Ticket introuvable." }); return; }
  await sendSupportReply(ticket.name, ticket.email, ticket.subject, message);
  const reply = { authorId: new Types.ObjectId(String(actor._id)), authorName: String(actor.username ?? "Support"), message, sentAt: new Date() };
  ticket.replies.push(reply as any);
  ticket.status = ticket.status === "resolved" ? "resolved" : "in_progress";
  ticket.assignedTo = new Types.ObjectId(String(actor._id)) as any;
  await ticket.save();
  if (ticket.ownerId) await notifyUserIfEnabled(await (await import("../model/user.model")).default.findById(ticket.ownerId).select("preferences").lean(), { kind: "support.reply", title: "Réponse du support", message: `${ticket.subject} · ${message.slice(0, 250)}`, targetType: "support-ticket", targetId: String(ticket._id) });
  await AdminAudit.create({ actorId: actor._id, actorName: actor.username, action: "contact.replied", targetType: "contact-ticket", targetId: String(ticket._id), targetLabel: ticket.subject, reason: message.slice(0, 500), ip: req.ip });
  res.status(201).json({ status: "Success", message: "Réponse envoyée et ajoutée à l’historique.", data: ticket.toObject() });
});

const listMyContactTickets = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?._id || await get_user_group_name({ user_id: new Types.ObjectId(String(user._id)) }) !== "Client") {
    res.status(403).json({ status: "Failed", message: "Connectez-vous à votre compte client pour consulter vos demandes." }); return;
  }
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(30, Math.max(1, Number.parseInt(String(req.query.limit ?? "10"), 10) || 10));
  const filter = { ownerId: user._id };
  const [data, total] = await Promise.all([ContactTicket.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), ContactTicket.countDocuments(filter)]);
  res.status(200).json({ status: "Success", data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

const replyToMyContactTicket = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?._id || await get_user_group_name({ user_id: new Types.ObjectId(String(user._id)) }) !== "Client") {
    res.status(403).json({ status: "Failed", message: "Cette action est réservée au compte client propriétaire du ticket." }); return;
  }
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (message.length < 2 || message.length > 4000) { res.status(400).json({ status: "Failed", message: "La réponse doit contenir entre 2 et 4 000 caractères." }); return; }
  const ticket = await ContactTicket.findOne({ _id: req.params.id, ownerId: user._id });
  if (!ticket) { res.status(404).json({ status: "Failed", message: "Ticket introuvable." }); return; }
  if (ticket.status === "resolved") { res.status(409).json({ status: "Failed", message: "Ce ticket est clôturé; créez une nouvelle demande si nécessaire." }); return; }
  await sendContactEmail(ticket.name, ticket.email, `Re: ${ticket.subject}`, message);
  ticket.replies.push({ authorId: new Types.ObjectId(String(user._id)), authorName: String(user.username ?? "Client"), message, sentAt: new Date() } as any);
  ticket.status = "open";
  await ticket.save();
  res.status(201).json({ status: "Success", message: "Votre réponse a été envoyée au support.", data: ticket.toObject() });
});

export { submitContactMessage, listContactTickets, updateContactTicket, replyToContactTicket, listMyContactTickets, replyToMyContactTicket };
