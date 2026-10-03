import { Request, Response, NextFunction } from "express";
import expressAsyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";

export const verifyToken = expressAsyncHandler((req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.jwt;
  if (!token) {
    (req as any).user = null;
    next();
    return;
  }

  const secret = process.env.TOKEN_SECRET;
  if (!secret) {
    res.status(401).json({ message: "Non authentifié" });
    return;
  }

  try {
    (req as any).user = jwt.verify(token, secret);
    next();
  } catch {
    res.status(401).json({ message: "Jeton d’authentification invalide ou expiré." });
  }
});
