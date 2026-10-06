import jwt, { JwtPayload } from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { Types } from "mongoose";
import { get_user_group_name } from "../service/user_group_member.service";

const auth = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.cookies.jwt;

    if (!token) {
      res.status(401).json({
        status: "Unauthorized",
        message: "Accès refusé.",
      });
      return;
    }

    try {
      const secret = process.env.TOKEN_SECRET;
      if (!secret) {
        res.status(500).json({ status: "Error", message: "L’authentification n’est pas configurée." });
        return;
      }
      const decodedToken = jwt.verify(token, secret) as JwtPayload;
      const allowedLimitedPaths = decodedToken.tokenPurpose === "password-reset"
        ? ["/email/verify", "/email/new_verification_code", "/email/reset-password"]
        : decodedToken.tokenPurpose === "email-verification"
          ? ["/email/verify", "/email/new_verification_code"]
          : null;
      if (req.path === "/email/reset-password" && decodedToken.otpVerified !== true) {
        res.status(403).json({ status: "Unauthorized", message: "Veuillez vérifier le code reçu par e-mail." });
        return;
      }
      if (allowedLimitedPaths && !allowedLimitedPaths.includes(req.path)) {
        res.status(403).json({ status: "Unauthorized", message: "Cette session ne permet pas d’accéder à cette ressource." });
        return;
      }

      if (!allowedLimitedPaths) {
        const userId = decodedToken._id;
        if (typeof userId !== "string" && !(userId instanceof Types.ObjectId)) {
          res.status(401).json({ status: "Unauthorized", message: "Session invalide." });
          return;
        }
        const role = await get_user_group_name({ user_id: new Types.ObjectId(userId) });
        if (!role) {
          res.clearCookie("jwt", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
          });
          res.status(403).json({ status: "Unauthorized", message: "Ce compte a été désactivé." });
          return;
        }
      }

      (req as any).user = decodedToken;
      next();
    } catch (error) {
      console.error("Erreur lors de la vérification du jeton :", error);
      res.status(401).json({ status: "Unauthorized", message: "Jeton d’authentification invalide." });
    }
  }
);


const guest = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.cookies.jwt;
    if (token) {
      res
        .status(402)
        .json({ status: "Unauthorized", message: "Accès refusé." });
      return;
    }
    next();
  },
);
export { auth, guest };
