import jwt, { JwtPayload } from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";

const optionalAuth = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.cookies?.jwt;
    if (!token) {
      next();
      return;
    }

    const secret = process.env.TOKEN_SECRET;
    if (!secret) {
      res.status(500).json({ status: "Error", message: "L’authentification n’est pas configurée." });
      return;
    }

    try {
      (req as any).user = jwt.verify(token, secret) as JwtPayload;
      next();
    } catch {
      res.status(401).json({ status: "Unauthorized", message: "Jeton d’authentification invalide." });
    }
  },
);

export default optionalAuth;
