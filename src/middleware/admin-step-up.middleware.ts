import jwt, { JwtPayload } from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { consumeAdminStepUpToken } from "../service/admin-step-up.service";

const requireAdminStepUp = expressAsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const token = req.get("x-admin-step-up");
  const secret = process.env.TOKEN_SECRET;
  if (!token || !secret) {
    res.status(403).json({ status: "Failed", message: "Une vérification admin par code e-mail est requise." });
    return;
  }
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, secret) as JwtPayload;
  } catch {
    res.status(403).json({ status: "Failed", message: "Le code de confirmation est invalide ou expiré." });
    return;
  }
  const userId = String((req as any).user?._id ?? "");
  if (payload.purpose !== "admin-step-up" || payload.userId !== userId) {
    res.status(403).json({ status: "Failed", message: "Le code de confirmation est invalide ou expiré." });
    return;
  }
  if (!await consumeAdminStepUpToken(userId, token)) {
    res.status(403).json({ status: "Failed", message: "Le code de confirmation est invalide, expiré ou déjà utilisé." });
    return;
  }
  next();
});

export default requireAdminStepUp;
