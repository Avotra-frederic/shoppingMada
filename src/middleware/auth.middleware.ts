import jwt, { JwtPayload } from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { Types } from "mongoose";
import { get_user_group_name } from "../service/user_group_member.service";
import { getUser } from "../service/user.service";

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
        ? ["/email/verify", "/email/new_verification_code", "/email/reset-password", "/auth/me"]
        : decodedToken.tokenPurpose === "email-verification"
          ? ["/email/verify", "/email/new_verification_code", "/auth/me"]
          : null;
      if (req.path === "/email/reset-password" && decodedToken.otpVerified !== true) {
        res.status(403).json({ status: "Unauthorized", message: "Veuillez vérifier le code reçu par e-mail." });
        return;
      }
      if (allowedLimitedPaths && !allowedLimitedPaths.includes(req.path)) {
        res.status(403).json({ status: "Unauthorized", message: "Cette session ne permet pas d’accéder à cette ressource." });
        return;
      }

      let effectiveToken: any = decodedToken;
      let impersonationInfo: any = null;
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
        if (role === "Support" || role === "Moderator" || role === "Finance" || role === "Read Only") {
          const membership: any = await (await import("../model/userGroupMember.model")).default.findOne({ user_id: userId }).select("adminPermissions").lean();
          (decodedToken as any).adminPermissions = membership?.adminPermissions ?? [];
          (decodedToken as any).userGroupMember_id = { user_id: userId, usergroup_id: { name: role } };
        }
        const membership = (decodedToken as any).userGroupMember_id;
        if (membership && typeof membership === "object") {
          membership.usergroup_id = { ...(membership.usergroup_id && typeof membership.usergroup_id === "object" ? membership.usergroup_id : {}), name: role };
        }
        const impersonationToken = req.cookies.adminImpersonation;
        if (impersonationToken) {
          try {
            const imp = jwt.verify(impersonationToken, secret) as JwtPayload;
            if (imp.purpose === "seller-impersonation" && String(imp.actorId) === String(userId) && typeof imp.targetId === "string" && role === "Super Admin") {
              const target = await getUser(imp.targetId);
              if (target && (target as any).userGroupMember_id?.usergroup_id?.name === "Boutiks" && (target as any).boutiks_id) {
                effectiveToken = target;
                impersonationInfo = { actorId: String(userId), actorName: String((decodedToken as any).username ?? "Super Admin"), targetId: String(imp.targetId), targetName: String((target as any).username ?? "Vendeur"), reason: String(imp.reason ?? "") };
                (req as any).baseUser = decodedToken;
                (req as any).impersonation = impersonationInfo;
                res.setHeader("X-ShopInMada-Impersonation", "active");
                res.setHeader("Cache-Control", "no-store");
                res.on("finish", () => {
                  void import("../model/admin-audit.model").then(({ default: AdminAudit }) => AdminAudit.create({ actorId: userId, actorName: impersonationInfo.actorName, action: "seller.impersonation.request", targetType: "user", targetId: impersonationInfo.targetId, targetLabel: impersonationInfo.targetName, reason: `${req.method} ${req.path} → ${res.statusCode}`, ip: req.ip })).catch(() => undefined);
                });
              }
            }
          } catch { res.clearCookie("adminImpersonation", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/" }); }
        }
      }

      (req as any).user = effectiveToken;
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
