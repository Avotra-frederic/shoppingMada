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
} from "../service/user.service";
import IUser from "../interface/user.interface";
import bcrypt, { compare } from "bcrypt";
import jwt from "jsonwebtoken";
import { findUserGroupId } from "../service/user_group.service";
import IUserGroupMember from "../interface/user_group_member.interface";
import { Types } from "mongoose";
import {
  add_user_in_user_group,
  delete_user_in_user_group,
  get_user_group_name,
} from "../service/user_group_member.service";
import { getOTP } from "../helpers/OTP.algo";
import sendEmail from "../helpers/mail";

const storeUser = expressAsyncHandler(async (req: Request, res: Response) => {
  const credentials: IUser = req.body;
  const existingUser = await checkExistingUser(credentials);
  if (existingUser) {
    res.status(401).json({
      status: "Failed",
      message:
        "Couldn't to create user! email or phonenumber is already taken!",
    });
    return;
  }
  const hashPassword = bcrypt.hashSync(credentials.password, 10);
  Object.assign(credentials, { password: hashPassword });
  const user = await createUser(credentials);
  if (!user) {
    res.status(401).json({
      status: "Failed",
      message: "Couldn't to create user! please try again",
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
    message: "User created successfully!",
  });
});

const login = expressAsyncHandler(async (req: Request, res: Response) => {
  const { emailOrPhone, password } = req.body;
  const user: IUser | null = await getUserWithCredentials({
    emailOrPhone,
    password,
  });
  if (!user) {
    res.status(401).json({ status: "Failed", message: "User does not exist!" });
    return;
  }

  const verified = await compare(password, user.password);
  if (!verified) {
    res.status(412).json({ message: "Mot de passe incorrect!" });
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
    const OTPCode: string = getOTP(user.email);

    const data = {
      title: "Vérification de l'adresse mail!",
      information: "Code de validation: ",
      CODE_OTP: OTPCode,
      message:
        "Merci d'avoir inscri(e) chez ShoppingMada! Afin de pourvoir se connecté, veuillez confirmé votre adresse en utilisant le code ci-desous",
      content:
        "Cette code ne dure que pendant 10 min àpres la récéption de cette message",
    };

    try {
      await sendEmail(data, user.email, "Verification de l'adresse mail");
    } catch (error) {
      if (error instanceof Error) {
        res.status(413).json({
          status: "Failed",
          message: "Verifier votre connextion internet",
        });
        return;
      }
    }
    const token = jwt.sign(authUser, process.env.TOKEN_SECRET as string, {
      expiresIn: "1h",
    });

    res.cookie("jwt", token, {
      httpOnly: true,
    });
    res.status(401).json({
      status: "Verification Failed",
      message: "Veuillez verifier votre adresse Email",
      userInfo: authUser,
    });
    return;
  }

  const token = jwt.sign(authUser, process.env.TOKEN_SECRET as string, {
    expiresIn: "1h",
  });

  res.cookie("jwt", token, {
    httpOnly: true,
  });

  res.status(201).json({
    status: "Success",
    message: "login successfully",
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
        .json({ status: "Failed", message: "User does not exist!" });
      return;
    }

    const { password, ...authUser } = updatedUser;
    const token = jwt.sign(authUser, process.env.TOKEN_SECRET as string, {
      expiresIn: "1h",
    });

    res.cookie("jwt", token, {
      httpOnly: true,
    });

    res.status(201).json({
      status: "Success",
      message: "token regenerate successfully",
      userInfo: authUser,
    });
  },
);

const getUserInfo = expressAsyncHandler(async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userInfo = await getUser(user._id);
    if (!user) {
      res.status(401).json({ status: "Failed", message: "Unauthorized!" });
      return;
    }

    if (!userInfo) {
      res
        .status(403)
        .json({ status: "Failed", message: "User does not exist" });
      return;
    }
    res.status(200).json({ status: "Success", userInfo });
  } catch (error) {
    throw error;
  }
});

const handleChangePassword = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const credentials: IUser = req.body;
    const user = await checkExistingUser(credentials);
    if (!user) {
      res
        .status(400)
        .json({ status: "Failed", message: "User does not exist!" });
      return;
    }
    const OTPCode: string = getOTP(user.email);
    const data = {
      title: "Vérification de l'adresse mail!",
      information: "Code de validation: ",
      CODE_OTP: OTPCode,
      message:
        "Merci d'avoir inscri(e) chez ShoppingMada! Afin de pourvoir se connecté, veuillez confirmé votre adresse en utilisant le code ci-desous",
      content:
        "Cette code ne dure que pendant 10 min àpres la récéption de cette message",
    };

    await sendEmail(data, credentials.email, "Verification de l'adresse mail");

    const { password, ...authUser } = user;

    const token = jwt.sign(authUser, process.env.TOKEN_SECRET as string, {
      expiresIn: "1h",
    });

    res.cookie("jwt", token, {
      httpOnly: true,
    });

    res.status(201).json({
      status: "Success",
      message: "login successfully",
      userInfo: authUser,
    });
  },
);

const logout = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ message: "Unautorized!" });
    return;
  }
  res.clearCookie("jwt", { httpOnly: true });
  res.clearCookie("refreshToken", { httpOnly: true });
  res.status(200).json({ status: "Success", message: "Logout successfully" });
});

const deleteAcount = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const deletedUser = await deleteUser(user._id);
    if (!deletedUser) {
      res
        .status(400)
        .json({ status: "Failed", message: "Cannot delete user!" });
      return;
    }
    res
      .status(200)
      .json({ status: "Success", message: "User deleted successfully" });
  },
);

const addProfilePicture = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const image = (req as any).fileName;

    if (!user) {
      res.status(401).json({ status: "Failed", message: "Unauthorized!" });
      return;
    }

    if (!image) {
      res.status(400).json({ status: "Failed", message: "Image not found!" });
      return;
    }

    const updatedUser = await updateUser(user._id, { photos: image } as IUser);
    if (!updatedUser) {
      res
        .status(400)
        .json({ status: "Failed", message: "Cannot update user!" });
      return;
    }

    res.status(200).json({
      status: "Success",
      message: "Profile picture added successfully",
    });
  },
);

const updateUserInfo = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const credentials: IUser = req.body;
    if (credentials.password) {
      const hashPassword = bcrypt.hashSync(credentials.password, 10);
      Object.assign(credentials, { password: hashPassword });
    }
    const updatedUser = await updateUser(user._id, credentials);
    if (!updatedUser) {
      res
        .status(400)
        .json({ status: "Failed", message: "Cannot update user!" });
      return;
    }

    res
      .status(200)
      .json({ status: "Success", message: "User updated successfully" });
  },
);
const all = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const users = await getAllUser();
  if (!users) {
    res.status(400).json({ status: "Failed", message: "Cannot update user!" });
    return;
  }

  res.status(200).json({ status: "Success", data: users });
});

const findUser = expressAsyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await getUser(id);
  if (!user) {
    res.status(400).json({ status: "Failed", message: "Cannot find user" });
    return;
  }
  res.status(200).json({ status: "Success", data: user });
});

const blockAccount = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await delete_user_in_user_group({
      user_id: new Types.ObjectId(id),
    });
    if (!user) {
      res
        .status(400)
        .json({ status: "Failed", message: "Cannot find user in user group" });
      return;
    }
    res.status(201).json({
      status: "Success",
      message: "User account Blocked successfully!",
    });
  },
);

const activeAccount = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await getUser(id);
    if (!user) {
      res.status(400).json({ status: "Failed", message: "Cannot find user!" });
      return;
    }

    if (user.boutiks_id) {
      const userGroup = await findUserGroupId("Boutiks");
      if (userGroup) {
        const addUserIntoUserGroup = {
          usergroup_id: userGroup?._id as Types.ObjectId,
          user_id: user._id as Types.ObjectId,
        };
        await add_user_in_user_group(addUserIntoUserGroup as IUserGroupMember);
        res
          .status(201)
          .json({ status: "Success", message: "User account actived!" });
        return;
      }
    } else {
      const userGroup = await findUserGroupId("Client");
      if (userGroup) {
        const addUserIntoUserGroup = {
          usergroup_id: userGroup?._id as Types.ObjectId,
          user_id: user._id as Types.ObjectId,
        };
        await add_user_in_user_group(addUserIntoUserGroup as IUserGroupMember);
        res
          .status(201)
          .json({ status: "Success", message: "User account actived!" });
        return;
      }
      res.status(400).json({ status: "Failed", message: "Failed" });
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
      res.status(400).json({ status: "Failed", message: "Account blocked" });
      return;
    }
    res.status(200).json({ status: "Success", message: "Account actived!" });
  },
);

const changeUserGroupToAdmin = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { id } = req.params;

    if (!user) {
      res.status(401).json({
        status: "Failed",
        message: "Vous devez vous connécté tout d'abord",
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
        .json({ status: "Failed", message: "Une erreur est survenu!" });
      return;
    }

    await updateUser(id, { userGroupMember_id: newUserGroup._id } as IUser);

    res
      .status(201)
      .json({ status: "Success", message: "Modification éffétué avec succès" });
  },
);

const authVerify = expressAsyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

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
    res.status(500).json({ message: "Erreur serveur", error: err });
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
