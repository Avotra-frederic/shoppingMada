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
    user._id as string,
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
    const updatedUser = await getUser(user._id);

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
      userInfo: authUser,
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
    const email = String(req.body.email ?? "").trim().toLowerCase();
    if (!email) {
      res.status(400).json({ status: "Failed", message: "L’adresse e-mail est obligatoire." });
      return;
    }
    const user = await checkExistingUser({ email, phonenumber: "" } as IUser);
    if (!user) {
      res
        .status(400)
        .json({ status: "Failed", message: "Utilisateur introuvable." });
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

    await sendEmail(data, user.email, "Réinitialisation de votre mot de passe");
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
      message: "Code de vérification envoyé",
      userInfo: authUser,
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
    if ((req as any).user?.userGroupMember_id?.usergroup_id?.name !== "Super Admin") {
      res.status(403).json({ status: "Failed", message: "Accès réservé à l'administration" });
      return;
    }
    const user = await delete_user_in_user_group({
      user_id: new Types.ObjectId(id),
    });
    if (!user) {
      res
        .status(400)
        .json({ status: "Failed", message: "Utilisateur introuvable dans son groupe." });
      return;
    }
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

    res
      .status(201)
      .json({ status: "Success", message: "La modification a été effectuée." });
  },
);

const authVerify = expressAsyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id;

  try {
    const user = await getUser(userId);
    if (!user) {
      res.status(404).json({ message: "Utilisateur introuvable" });
      return;
    }

    // Évite d'envoyer le mot de passe
    const { password, ...safeUser } = user;

    res.status(200).json({ userInfo: safeUser });
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
