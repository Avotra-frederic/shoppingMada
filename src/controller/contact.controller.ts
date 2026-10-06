import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { sendContactEmail } from "../helpers/mail";

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

  try {
    await sendContactEmail(safeName, safeEmail, safeSubject, safeMessage);
    res.status(200).json({ status: "Success", message: "Votre message a été envoyé. Notre équipe vous répondra dès que possible." });
  } catch (error) {
    const mailError = error as NodeJS.ErrnoException & { responseCode?: number };
    console.error("Contact email delivery failed", { code: mailError.code, responseCode: mailError.responseCode });
    res.status(503).json({ status: "Failed", message: "Le service de messagerie est temporairement indisponible. Réessayez plus tard." });
  }
});

export { submitContactMessage };