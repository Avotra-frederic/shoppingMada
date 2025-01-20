import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import {
  checkExistingUser,
  createUser,
  deleteUser,
  getUser,
  getUserWithCredentials,
  updateUser,
} from "../service/user.service";
import IUser from "../interface/user.interface";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { findUserGroupId } from "../service/user_group.service";
import IUserGroupMember from "../interface/user_group_member.interface";
import { Types } from "mongoose";
import {
  add_user_in_user_group,
  get_user_group_name,
} from "../service/user_group_member.service";
import { getOTP } from "../helpers/OTP.algo";
import sendEmail from "../helpers/mail";


const storeUser = expressAsyncHandler(
  async (req: Request, res: Response) => {
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
    await add_user_in_user_group(addUserIntoUserGroup as IUserGroupMember);

    const { password, ...authUser } = credentials;
    const userGroup = "Client";
    const tokenPayload = { ...authUser, _id: user._id };
    const token = jwt.sign(tokenPayload, process.env.TOKEN_SECRET as string, {
      expiresIn: "1h",
    });

    res.cookie("jwt", token, {
      httpOnly: true,
    });

    const OTPCode: string = getOTP(user.email);

    const data = {
      CODE_OTP: OTPCode,
    };

    await sendEmail(data, credentials.email);
    const updatedUser = { ...authUser, userGroup };
    res.status(201).json({
      status: "Success",
      message: "User created successfully!",
      userInfo: updatedUser,
    });
  },
);


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

  const authUser = Object.keys(user).reduce((acc: any, userKey) => {
    if (userKey != "password")
      acc[userKey as keyof IUser] = user[userKey as keyof IUser];
    return acc;
  }, {});

  const token = jwt.sign(authUser, process.env.TOKEN_SECRET as string, {
    expiresIn: "1h",
  });

  res.cookie("jwt", token, {
    httpOnly: true,
  });

  const userGroup = await get_user_group_name({ user_id: authUser._id });
  if (!userGroup) {
    res
      .status(401)
      .json({ status: "Failed", message: "Cannot find group for user!" });
    return;
  }

  const updatedUser = { ...authUser, userGroup};

  res.status(201).json({
    status: "Success",
    message: "login successfully",
    userInfo: updatedUser,
  });
});

const regenerateToken = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const updatedUser = await getUser(user._id);

    if (!updatedUser) {
      res
        .status(401)
        .json({ status: "Failed", message: "User does not exist!" });
      return;
    }

    const { password, ...authUser } = updatedUser;
    const token = jwt.sign(authUser, process.env.TOKEN_SECRET as string, {
      expiresIn: "1h",
    });

    res.cookie("jwt", token, {
      httpOnly: true,
    })

    const userGroup = await get_user_group_name({
      user_id: authUser._id as Types.ObjectId,
    });
    if (!userGroup) {
      res
        .status(401)
        .json({ status: "Failed", message: "Cannot find group for user!" });
      return;
    }

    const updatedUserInfo = { ...authUser, userGroup };

    res.status(201).json({
      status: "Success",
      message: "token regenerate successfully",
      userInfo: updatedUserInfo,
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
      CODE_OTP: OTPCode,
    };

    await sendEmail(data, credentials.email);

    const { password, ...authUser } = user;

    const token = jwt.sign(authUser, process.env.TOKEN_SECRET as string, {
      expiresIn: "1h",
    });

    res.cookie("jwt", token, {
      httpOnly: true,
    })
    const userGroup = await get_user_group_name({ user_id: authUser._id as Types.ObjectId });
    if (!userGroup) {
      res
        .status(401)
        .json({ status: "Failed", message: "Cannot find group for user!" });
      return;
    }

    const updatedUser = { ...authUser, userGroup, };

    res.status(201).json({
      status: "Success",
      message: "login successfully",
      userInfo: updatedUser,
    });
  },
);

const logout = expressAsyncHandler(async (req: Request, res: Response) => {
  res.clearCookie("jwt",{httpOnly: true});
  res.clearCookie("refreshToken",{httpOnly: true});
  res.status(200).json({ status: "Success", message: "Logout successfully" });
});

const deleteAcount = expressAsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const deletedUser = await deleteUser(user._id);
  if (!deletedUser) {
    res
      .status(400)
      .json({ status: "Failed", message: "Cannot delete user!" });
    return;
  }
  res.status(200).json({ status: "Success", message: "User deleted successfully" });
})

const addProfilePicture = expressAsyncHandler(async(req: Request, res: Response)=>{
  const user = (req as any).user;
  const image = (req as any).fileName;

  if(!user){
    res.status(401).json({status: "Failed", message: "Unauthorized!"});
    return;
  }

  if(!image){
    res.status(400).json({status: "Failed", message: "Image not found!"});
    return;
  }

  const updatedUser = await updateUser(user._id, {photos: image} as IUser);
  if(!updatedUser){
    res.status(400).json({status: "Failed", message: "Cannot update user!"});
    return;
  }

  res.status(200).json({status: "Success", message: "Profile picture added successfully"});

})

const updateUserInfo = expressAsyncHandler(async(req: Request, res: Response)=>{
  const user = (req as any).user;
  const credentials: IUser = req.body;
  const updatedUser = await updateUser(user._id, credentials);
  if(!updatedUser){
    res.status(400).json({status: "Failed", message: "Cannot update user!"});
    return;
  }

  res.status(200).json({status: "Success", message: "User updated successfully"});
})

export { storeUser, login, regenerateToken, getUserInfo, handleChangePassword,logout, deleteAcount, addProfilePicture, updateUserInfo };
