import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import fs from "fs"
import path from "path"
import {
  checkExistingUser,
  createUser,
  getUserWithCredentials,
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
import Handlebars from "handlebars";
import emailSender from "../helpers/mail";
const storeUser = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const credentials: IUser = req.body;
    const existingUser = await checkExistingUser(credentials);
    if (existingUser) {
      res.status(401).json({
        status: "Failed",
        message: "Couldn't to create user! email or phonenumber is already taken!",
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

    const OTPCode : string = getOTP(user.email);
    const htmlTemplate = fs.readFileSync(path.join(__dirname,"..","..", "public","template","email.html"), "utf8");
    const template = Handlebars.compile(htmlTemplate);
    const data = {
      CODE_OTP: OTPCode,
    }

    const htmlContent = template(data);

    const mailOption = {
      from:process.env.EMAIL_USER,
      to: credentials.email,
      subject: "Verification email",
      html: htmlContent,
      attachements:[
        {
          filename:"background.png",
          path: path.join(__dirname,"..","..","public","mail","background.png"),
          cid:"background"
        },
        {
          filename:"animated_header.gif",
          path: path.join(__dirname,"..","..","public","mail","animated_header.gif"),
          cid:"animated"
        },
        {
          filename:"logo.png",
          path: path.join(__dirname,"..","..","public","mail","logo.png"),
          cid: "logo"
        },
        {
          filename:"Beefree-logo.png",
          path: path.join(__dirname,"..","..","public","mail","Beefree-logo.png"),
          cid: "Beefree"
        },
      ]
    }

    await emailSender(mailOption);
    
    res
      .status(201)
      .json({ status: "Success", message: "User created successfully!", OTPCode });
  }
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

  const userGroup = await get_user_group_name({ user_id: authUser._id });
  if (!userGroup) {
    res
      .status(401)
      .json({ status: "Failed", message: "Cannot find group for user!" });
    return;
  }

  const updatedUser = { ...authUser, userGroup, token };

  res.status(201).json({
    status: "Success",
    message: "login successfully",
    userInfo: updatedUser,
  });
});

export { storeUser, login };
