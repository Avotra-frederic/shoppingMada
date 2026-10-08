import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";

const requireAdminPermission = (permission: string) => expressAsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user: any = (req as any).user;
  const role = user?.userGroupMember_id?.usergroup_id?.name;
  if (role === "Super Admin") { next(); return; }
  if (!user || !["Support", "Moderator", "Finance", "Read Only"].includes(role) || !Array.isArray(user.adminPermissions) || !user.adminPermissions.includes(permission)) {
    res.status(403).json({ status: "Failed", message: "Permission d’administration insuffisante." }); return;
  }
  next();
});

export default requireAdminPermission;
