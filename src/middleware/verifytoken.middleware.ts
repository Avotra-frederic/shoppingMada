import { Request, Response, NextFunction } from "express";
import expressAsyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";

export const verifyToken = expressAsyncHandler((req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.jwt;
  const secret = process.env.TOKEN_SECRET;
  if (!token || !secret) {
    res.status(401).json({ message: "Non authentifié" });
    return;
  }

  try {
    (req as any).user = jwt.verify(token, secret);
    next();
  } catch {
    res.status(401).json({ message: "Token invalide ou expiré" });
  }
});
