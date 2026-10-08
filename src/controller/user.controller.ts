import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import {
  checkExistingUser,
  createUser,
  deleteUser,
  getAllUser,
  getUser,
  getUserWithCredentials,
  updateUser,
  createEmailOtp,
} from "../service/user.service";
import IUser from "../interface/user.interface";
import bcrypt, { compare } from "bcryptjs";
import jwt from "jsonwebtoken";
import { findUserGroupId } from "../service/user_group.service";
import IUserGroupMember from "../interface/user_group_member.interface";
import { Types } from "mongoose";
import {
  add_user_in_user_group,
  delete_user_in_user_group,
  get_user_group_name,
} from "../service/user_group_member.service";
import sendEmail from "../helpers/mail";
import { updateBoutiks } from "../service/boutiks.service";
import { recordAdminAction } from "../service/admin-audit.service";
import User from "../model/user.model";

const storeUser = expressAsyncHandler(async (req: Request, res: Response) => {
  const credentials = {
    username: String(req.body.username ?? "").trim(),
    email: String(req.body.email ?? "").trim().toLowerCase(),
    phonenumber: String(req.body.phonenumber ?? "").trim(),
    password: String(req.body.password ?? ""),
  } as IUser;
  const existingUser = await checkExistingUser(credentials);
  if (existingUser) {
    res.status(401).json({
      status: "Failed",
        message: "Cette adresse e-mail ou ce numéro de téléphone est déjà utilisé.",
    });
    return;
  }
  const hashPassword = await bcrypt.hash(credentials.password, 10);
  Object.assign(credentials, { password: hashPassword });
  const user = await createUser(credentials);
  if (!user) {
      res.status(401).json({
      status: "Failed",
        message: "Impossible de créer le compte. Veuillez réessayer.",
    });
    return;
  }
  let addUserIntoUserGroup;
  const userGroupName = await findUserGroupId("Client");
  if (userGroupName) {
    addUserIntoUserGroup = {
      usergroup_id: userGroupName?._id as Types.ObjectId,
      user_id: user._id as Types.ObjectId,
    };
  }
  const usermember: IUserGroupMember = (await add_user_in_user_group(
    addUserIntoUserGroup as IUserGroupMember,
  )) as IUserGroupMember;
  await updateUser(
    String(user._id),
    { userGroupMember_id: usermember._id } as IUser,
  );

  res.status(201).json({
    status: "Success",
     message: "Votre compte a été créé.",
  });
});

const login = expressAsyncHandler(async (req: Request, res: Response) => {
  const { emailOrPhone, password } = req.body;
  const user: IUser | null = await getUserWithCredentials({
    emailOrPhone,
    password,
  });
  if (!user) {
    res.status(401).json({ status: "Failed", message: "Identifiants incorrects." });
    return;
  }

  const verified = await compare(password, user.password);
  if (!verified) {
    res.status(412).json({ message: "Mot de passe incorrect." });
    return;
  }

  const authUser: IUser = Object.keys(user).reduce((acc: any, userKey) => {
    if (userKey != "password")
      acc[userKey as keyof IUser] = user[userKey as keyof IUser];
    return acc;
  }, {});

  if (!authUser.userGroupMember_id) {
    res
      .status(403)
      .json({ message: "Votre compte est désactivé!", userInfo: authUser });
    return;
  }

  if (!user.emailVerifyAt) {
    const OTPCode: string = await createEmailOtp(String(user._id));

    const data = {
      title: "Vérification de votre adresse e-mail",
      information: "Code de validation: ",
      CODE_OTP: OTPCode,
      message: "Merci de vous être inscrit sur ShopInMada. Pour vous connecter, veuillez confirmer votre adresse e-mail à l’aide du code ci-dessous.",
      content: "Ce code expire 10 minutes après sa réception.",
    };

    try {
      await sendEmail(data, user.email, "Vérification de votre adresse e-mail");
    } catch (error) {
      const mailError = error as NodeJS.ErrnoException & { responseCode?: number };
      console.error("Failed to send email verification code", {
        code: mailError.code,
        responseCode: mailError.responseCode,
      });
      res.status(503).json({
        status: "Failed",
        message: "Impossible d’envoyer le code de vérification. Vérifiez la configuration email du serveur et réessayez.",
      });
      return;
    }
    const token = jwt.sign({ ...authUser, tokenPurpose: "email-verification" }, process.env.TOKEN_SECRET as string, {
      expiresIn: "1h",
    });

    res.cookie("jwt", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 1000,
      path: "/",
    });
    res.status(200).json({
      status: "Verification Failed",
        message: "Veuillez vérifier votre adresse e-mail.",
      userInfo: authUser,
    });
    return;
  }

  const token = jwt.sign(authUser, process.env.TOKEN_SECRET as string, {
    expiresIn: "1h",
  });

    res.cookie("jwt", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 1000,
      path: "/",
    });

  res.status(201).json({
    status: "Success",
      message: "Connexion réussie.",
    userInfo: authUser,
  });
});

const regenerateToken = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
      const impersonation = (req as any).impersonation;
      const baseUser = (req as any).baseUser;
      const updatedUser = await getUser(impersonation ? baseUser._id : user._id);

    if (!updatedUser) {
      res
        .status(405)
        .json({ status: "Failed", message: "Utilisateur introuvable." });
      return;
    }

      const { password, ...authUser } = updatedUser;
    const token = jwt.sign(authUser, process.env.TOKEN_SECRET as string, {
      expiresIn: "1h",
    });

    res.cookie("jwt", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(201).json({
      status: "Success",
        message: "La session a été renouvelée.",
        userInfo: impersonation ? { ...user, impersonation: { active: true, actorName: impersonation.actorName, expiresInSeconds: 900 } } : authUser,
    });
  },
);

const getUserInfo = expressAsyncHandler(async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userInfo = await getUser(user._id);
    if (!user) {
      res.status(401).json({ status: "Failed", message: "Authentification requise." });
      return;
    }

    if (!userInfo) {
      res
        .status(403)
        .json({ status: "Failed", message: "Utilisateur introuvable." });
      return;
    }
    const { password: _password, ...safeUser } = userInfo;
    res.status(200).json({ status: "Success", userInfo: safeUser });
  } catch (error) {
    throw error;
  }
});

const handleChangePassword = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const genericMessage = "Si un compte correspond à cette adresse, un code de vérification va être envoyé.";
    const email = String(req.body.email ?? "").trim().toLowerCase();
    if (!email) {
      res.status(400).json({ status: "Failed", message: "L’adresse e-mail est obligatoire." });
      return;
    }
    const user = await checkExistingUser({ email, phonenumber: "" } as IUser);
    if (!user) {
      res.status(201).json({ status: "Success", message: genericMessage });
      return;
    }
    const OTPCode: string = await createEmailOtp(String(user._id));
    const data = {
      title: "Réinitialisation de votre mot de passe",
      information: "Code de validation: ",
      CODE_OTP: OTPCode,
      message: "Vous avez demandé la réinitialisation de votre mot de passe. Saisissez le code ci-dessous pour vérifier votre adresse e-mail.",
      content: "Ce code expire 10 minutes après sa réception.",
    };

    try {
      await sendEmail(data, user.email, "Réinitialisation de votre mot de passe");
    } catch (error) {
      const mailError = error as NodeJS.ErrnoException & { responseCode?: number };
      console.error("Failed to send password reset code", {
        code: mailError.code,
        responseCode: mailError.responseCode,
      });
      res.status(201).json({ status: "Success", message: genericMessage });
      return;
    }
    const { password: _password, ...authUser } = user;
    const token = jwt.sign({ ...authUser, tokenPurpose: "password-reset" }, process.env.TOKEN_SECRET as string, { expiresIn: "10m" });
    res.cookie("jwt", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 10 * 60 * 1000,
    });

    res.status(201).json({
      status: "Success",
      message: genericMessage,
    });
  },
);

const logout = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ message: "Authentification requise." });
    return;
  }
    res.clearCookie("jwt", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" });
  res.clearCookie("refreshToken", { httpOnly: true });
  res.status(200).json({ status: "Success", message: "Vous êtes déconnecté." });
});

const deleteAcount = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (user.userGroupMember_id?.usergroup_id?.name !== "Super Admin") {
      res.status(403).json({ status: "Failed", message: "Accès réservé à l'administration" });
      return;
    }
    const deletedUser = await deleteUser(user._id);
    if (!deletedUser) {
      res
        .status(400)
        .json({ status: "Failed", message: "Impossible de supprimer le compte." });
      return;
    }
    res
      .status(200)
      .json({ status: "Success", message: "Le compte a été supprimé." });
  },
);

const addProfilePicture = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const image = (req as any).fileName;

    if (!user) {
      res.status(401).json({ status: "Failed", message: "Authentification requise." });
      return;
    }

    if (!image) {
      res.status(400).json({ status: "Failed", message: "Aucune image n’a été reçue." });
      return;
    }

    const updatedUser = await updateUser(user._id, { photos: image } as IUser);
    if (!updatedUser) {
      res
        .status(400)
        .json({ status: "Failed", message: "Impossible de mettre à jour le compte." });
      return;
    }

    res.status(200).json({
      status: "Success",
      message: "La photo de profil a été ajoutée.",
    });
  },
);

const updateUserInfo = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const credentials: IUser = req.body;
    if (credentials.userGroupMember_id || credentials.boutiks_id || credentials.emailVerifyAt || credentials.password || credentials.email) {
      res.status(400).json({ status: "Failed", message: "Ces champs ne peuvent pas être modifiés ici" });
      return;
    }    const updatedUser = await updateUser(user._id, credentials);
    if (!updatedUser) {
      res
        .status(400)
        .json({ status: "Failed", message: "Impossible de mettre à jour le compte." });
      return;
    }

    res
      .status(200)
      .json({ status: "Success", message: "Le compte a été mis à jour." });
  },
);
const all = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user?.userGroupMember_id?.usergroup_id?.name !== "Super Admin") {
    res.status(403).json({ status: "Failed", message: "Accès réservé à l'administration" });
    return;
  }
    const isPaginated = Boolean(req.query.page || req.query.limit || req.query.q || req.query.role || req.query.status);
    if (isPaginated) {
      const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20));
      const conditions: any[] = [];
      if (typeof req.query.q === "string" && req.query.q.trim()) {
        const q = req.query.q.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const shops = await (await import("../model/boutiks.model")).default.find({ name: { $regex: q, $options: "i" } }).distinct("owner_id");
        const groups = await (await import("../model/userGroup.model")).default.find({ name: { $regex: q, $options: "i" } }).distinct("_id");
        const members = await (await import("../model/userGroupMember.model")).default.find({ usergroup_id: { $in: groups } }).distinct("_id");
        conditions.push({ $or: [{ username: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }, { phonenumber: { $regex: q, $options: "i" } }, { _id: { $in: shops } }, { userGroupMember_id: { $in: members } }] });
      }
      if (typeof req.query.role === "string" && req.query.role !== "all") {
        if (req.query.role === "disabled") conditions.push({ $or: [{ userGroupMember_id: { $exists: false } }, { userGroupMember_id: null }] });
        else {
          const group = await (await import("../model/userGroup.model")).default.findOne({ name: req.query.role }).select("_id").lean<any>();
          const members = group ? await (await import("../model/userGroupMember.model")).default.find({ usergroup_id: group._id }).distinct("_id") : [];
          conditions.push({ userGroupMember_id: { $in: members } });
        }
      }
      if (req.query.status === "active") conditions.push({ userGroupMember_id: { $exists: true, $ne: null } });
      if (req.query.status === "inactive") conditions.push({ $or: [{ userGroupMember_id: { $exists: false } }, { userGroupMember_id: null }] });
      const filter: any = conditions.length ? { $and: conditions } : {};
      const [rows, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean<any[]>().populate({ path: "boutiks_id", populate: { path: "subscription_id" } }).populate({ path: "userGroupMember_id", populate: { path: "usergroup_id" } }).populate("personnalInfo_id"), User.countDocuments(filter)]);
      const data = rows.map(({ password: _password, ...safe }: any) => safe);
      const roleStats = await User.aggregate([{ $lookup: { from: "usergroupmembers", localField: "userGroupMember_id", foreignField: "_id", as: "member" } }, { $unwind: { path: "$member", preserveNullAndEmptyArrays: true } }, { $lookup: { from: "usergroups", localField: "member.usergroup_id", foreignField: "_id", as: "group" } }, { $unwind: { path: "$group", preserveNullAndEmptyArrays: true } }, { $group: { _id: "$group.name", count: { $sum: 1 } } }]);
      res.status(200).json({ status: "Success", data, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, stats: { total: roleStats.reduce((sum: number, item: any) => sum + item.count, 0), sellers: roleStats.find((item: any) => item._id === "Boutiks")?.count ?? 0, clients: roleStats.find((item: any) => item._id === "Client")?.count ?? 0, active: roleStats.filter((item: any) => item._id).reduce((sum: number, item: any) => sum + item.count, 0) } });
      return;
    }
    const users = await getAllUser();
  if (!users) {
    res.status(400).json({ status: "Failed", message: "Impossible de récupérer les utilisateurs." });
    return;
  }

  res.status(200).json({ status: "Success", data: users.map(({ password: _password, ...safeUser }) => safeUser) });
});

const findUser = expressAsyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const requester = (req as any).user;
  if (requester.userGroupMember_id?.usergroup_id?.name !== "Super Admin") {
    res.status(403).json({ status: "Failed", message: "Accès réservé à l'administration" });
    return;
  }
  const user = await getUser(id);
  if (!user) {
    res.status(400).json({ status: "Failed", message: "Utilisateur introuvable." });
    return;
  }
  const { password: _password, ...safeUser } = user;
  res.status(200).json({ status: "Success", data: safeUser });
});

const blockAccount = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const requester = (req as any).user;
    if (requester?.userGroupMember_id?.usergroup_id?.name !== "Super Admin") {
      res.status(403).json({ status: "Failed", message: "Accès réservé à l'administration" });
      return;
    }
    const target = await getUser(id);
    if (!target) {
      res.status(404).json({ status: "Failed", message: "Utilisateur introuvable." });
      return;
    }
    if (String(target._id) === String(requester._id)) {
      res.status(400).json({ status: "Failed", message: "Vous ne pouvez pas désactiver votre propre compte." });
      return;
    }
    if ((target as any).userGroupMember_id?.usergroup_id?.name === "Super Admin") {
      res.status(403).json({ status: "Failed", message: "Un compte Super Admin ne peut pas être désactivé depuis cette action." });
      return;
    }
    const shopId = (target as any).boutiks_id?._id ?? (target as any).boutiks_id;
    if (shopId) {
      const updatedShop = await updateBoutiks(String(shopId), { isActive: false });
      if (!updatedShop) {
        res.status(500).json({ status: "Failed", message: "Impossible de désactiver la boutique associée." });
        return;
      }
    }
    const membership = await delete_user_in_user_group({
      user_id: new Types.ObjectId(id),
    });
    if (!membership) {
      if (shopId) await updateBoutiks(String(shopId), { isActive: true });
      res
        .status(400)
        .json({ status: "Failed", message: "Utilisateur introuvable dans son groupe." });
      return;
    }
    await recordAdminAction({ actorId: String(requester._id), actorName: requester.username ?? "Super Admin", action: "account.suspended", targetType: "user", targetId: String(target._id), targetLabel: target.username, reason: String(req.body?.reason ?? "").slice(0, 500), ip: req.ip });
    res.status(201).json({
      status: "Success",
        message: "Le compte a été désactivé.",
    });
  },
);

const activeAccount = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    if ((req as any).user?.userGroupMember_id?.usergroup_id?.name !== "Super Admin") {
      res.status(403).json({ status: "Failed", message: "Accès réservé à l'administration" });
      return;
    }
    const user = await getUser(id);
    if (!user) {
      res.status(400).json({ status: "Failed", message: "Utilisateur introuvable." });
      return;
    }

    if (user.boutiks_id) {
      const userGroup = await findUserGroupId("Boutiks");
      if (userGroup) {
        const addUserIntoUserGroup = {
          usergroup_id: userGroup?._id as Types.ObjectId,
          user_id: user._id as Types.ObjectId,
        };
        const member = await add_user_in_user_group(addUserIntoUserGroup as IUserGroupMember);
        if (member) await updateUser(id, { userGroupMember_id: member._id } as IUser);
        if (member) {
          const shopId = (user.boutiks_id as any)?._id ?? user.boutiks_id;
          if (shopId) {
            const updatedShop = await updateBoutiks(String(shopId), { isActive: true });
            if (!updatedShop) {
              res.status(500).json({ status: "Failed", message: "Le compte a été réactivé, mais la boutique n’a pas pu être rendue visible." });
              return;
            }
          }
        }
        if (member) await recordAdminAction({ actorId: String((req as any).user._id), actorName: (req as any).user.username ?? "Super Admin", action: "account.reactivated", targetType: "user", targetId: String(user._id), targetLabel: user.username, ip: req.ip });
        res
          .status(201)
          .json({ status: "Success", message: "Le compte a été réactivé." });
        return;
      }
    } else {
      const userGroup = await findUserGroupId("Client");
      if (userGroup) {
        const addUserIntoUserGroup = {
          usergroup_id: userGroup?._id as Types.ObjectId,
          user_id: user._id as Types.ObjectId,
        };
        const member = await add_user_in_user_group(addUserIntoUserGroup as IUserGroupMember);
        if (member) await updateUser(id, { userGroupMember_id: member._id } as IUser);
        if (member) await recordAdminAction({ actorId: String((req as any).user._id), actorName: (req as any).user.username ?? "Super Admin", action: "account.reactivated", targetType: "user", targetId: String(user._id), targetLabel: user.username, ip: req.ip });
        res
          .status(201)
          .json({ status: "Success", message: "Le compte a été réactivé." });
        return;
      }
      res.status(400).json({ status: "Failed", message: "Impossible de réactiver le compte." });
    }
  },
);

const checkUserAccount = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const requester = (req as any).user;
    if (requester?.userGroupMember_id?.usergroup_id?.name !== "Super Admin") {
      res.status(403).json({ status: "Failed", message: "Accès réservé au Super Admin." });
      return;
    }
    const { id } = req.params;
    const userGroup = await get_user_group_name({
      user_id: new Types.ObjectId(id),
    });
    if (!userGroup) {
      res.status(400).json({ status: "Failed", message: "Le compte est désactivé." });
      return;
    }
    res.status(200).json({ status: "Success", message: "Le compte est actif." });
  },
);

const changeUserGroupToAdmin = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { id } = req.params;

    if (!user || user.userGroupMember_id?.usergroup_id?.name !== "Super Admin") {
      res.status(401).json({
        status: "Failed",
          message: "Vous devez d’abord vous connecter.",
      });
      return;
    }

    const userGroup = await findUserGroupId("Super Admin");
    const newUserGroup = await add_user_in_user_group({
      user_id: new Types.ObjectId(id),
      usergroup_id: userGroup?._id as Types.ObjectId,
    } as IUserGroupMember);
    if (!newUserGroup) {
      res
        .status(403)
        .json({ status: "Failed", message: "Une erreur est survenue." });
      return;
    }

    await updateUser(id, { userGroupMember_id: newUserGroup._id } as IUser);

    await recordAdminAction({ actorId: String(user._id), actorName: user.username ?? "Super Admin", action: "account.promoted_super_admin", targetType: "user", targetId: String(id), targetLabel: (await getUser(id))?.username ?? "", reason: String(req.body?.reason ?? "").slice(0, 500), ip: req.ip });

    res
      .status(201)
      .json({ status: "Success", message: "La modification a été effectuée." });
  },
);

const authVerify = expressAsyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;
  if (!userId) {
    res.status(200).json({ userInfo: null });
    return;
  }

  try {
    const user = await getUser(userId);
    if (!user) {
      res.status(404).json({ message: "Utilisateur introuvable" });
      return;
    }

    // Évite d'envoyer le mot de passe
    const { password, ...safeUser } = user;

      const impersonation = (req as any).impersonation;
      res.status(200).json({ userInfo: impersonation ? { ...safeUser, impersonation: { active: true, actorName: impersonation.actorName, expiresInSeconds: 900 } } : safeUser });
  } catch (err) {
    console.error("Erreur lors de la vérification de la session :", err);
    res.status(500).json({ message: "Une erreur interne est survenue." });
  }
});

export {
  all,
  storeUser,
  checkUserAccount,
  login,
  blockAccount,
  activeAccount,
  findUser,
  regenerateToken,
  getUserInfo,
  handleChangePassword,
  logout,
  deleteAcount,
  addProfilePicture,
  updateUserInfo,
  changeUserGroupToAdmin,
  authVerify
};
