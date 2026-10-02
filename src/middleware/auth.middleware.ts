import jwt, { JwtPayload } from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";

const auth = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.cookies.jwt;

    if (!token) {
      res.status(401).json({
        status: "Unauthorized",
        message: "Access denied!",
      });
      return;
    }

    try {
      const secret = process.env.TOKEN_SECRET;
      if (!secret) {
        res.status(500).json({ status: "Error", message: "Authentication is not configured" });
        return;
      }
      const decodedToken = jwt.verify(token, secret) as JwtPayload;
      const allowedLimitedPaths = decodedToken.tokenPurpose === "password-reset"
        ? ["/email/verify", "/email/new_verification_code", "/email/reset-password"]
        : decodedToken.tokenPurpose === "email-verification"
          ? ["/email/verify", "/email/new_verification_code"]
          : null;
      if (req.path === "/email/reset-password" && decodedToken.otpVerified !== true) {
        res.status(403).json({ status: "Unauthorized", message: "Veuillez vérifier le code reçu par email." });
        return;
      }
      if (allowedLimitedPaths && !allowedLimitedPaths.includes(req.path)) {
        res.status(403).json({ status: "Unauthorized", message: "This session cannot access this resource." });
        return;
      }

  
      (req as any).user = decodedToken;
      next();
    } catch (error) {
      console.error("Erreur lors de la vérification du token :", error);
      res.status(401).json({ status: "Unauthorized", message: "Invalid token!" });
    }
  }
);


const guest = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.cookies.jwt;
    if (token) {
      res
        .status(402)
        .json({ status: "Unauthorized", message: "Access denied!" });
      return;
    }
    next();
  },
);
export { auth, guest };
