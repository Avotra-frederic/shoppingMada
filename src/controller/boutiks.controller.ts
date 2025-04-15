import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import IBoutiks from "../interface/boutiks.interface";
import {
  addNewCategorie,
  create_boutiks,
  delete_boutiks,
  findBoutiks,
  updateBoutiks,
} from "../service/boutiks.service";
import { findUserGroupId } from "../service/user_group.service";
import { change_user_group } from "../service/user_group_member.service";
import { Types } from "mongoose";
import { updateUser } from "../service/user.service";
import IUser from "../interface/user.interface";

const storeBoutiksInfo = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const data: IBoutiks = req.body;
    Object.assign(data, { owner_id: (req as any).user._id });
    if ((req as any).fileName) {
      data.logo = (req as any).fileName;
    } else {
      res.status(400).json({ status: "Failed", message: "Logo is required" });
      return;
    }

    const createBoutiks = await create_boutiks(data);
    if (!createBoutiks) {
      res.status(401).json({
        status: "Failed",
        message: "Cannot create Boutiks, please try later.",
      });
      return;
    }

    const updated_user = await updateUser((req as any).user._id, {
      boutiks_id: createBoutiks._id,
    } as IUser);
    console.log(updated_user);
    if (!updated_user) {
      res
        .status(500)
        .json({ message: "Cannot update user info please try again later!" });
      return;
    }
    const userGroup = await findUserGroupId("Boutiks");
    if (!userGroup) {
      res.status(400).json({
        status: "Failed",
        message: "Cannot find user group, please try later.",
      });
      return;
    }
    const updateUsers = await change_user_group({
      user_id: (req as any).user._id,
      newusergroup_id: userGroup?._id as Types.ObjectId,
    });
    if (!updateUsers) {
      await delete_boutiks(createBoutiks?._id as unknown as string);
      res.status(402).json({
        status: "Failed",
        message: "Cannot update user group, please try later.",
      });
      return;
    }
    res
      .status(201)
      .json({ status: "Success", message: "Boutiks created successfully!" });
  },
);

const getBoutiksInfo = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ status: "Failed", message: "Unauthorized" });
      return;
    }

    const boutiks = await findBoutiks(user._id);
    if (!boutiks) {
      res
        .status(400)
        .json({ status: "Failed", message: "Cannot find boutiks" });
      return;
    }

    res.status(200).json({ status: "Success", boutiks });
  },
);

const deleteBoutiks = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const boutiks = await findBoutiks(user._id);

    if (!user && !boutiks) {
      res.status(401).json({ status: "Failed", message: "Unauthorized" });
      return;
    }

    await delete_boutiks(boutiks?._id as unknown as string);

    res
      .status(200)
      .json({ status: "Success", message: "Boutiks deleted successfully!" });
  },
);

const updateBoutiksInfo = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const boutiks = await findBoutiks(user._id);
    const data = req.body;
    const logo = (req as any).fileName;

    if (!user && !boutiks) {
      res.status(401).json({ status: "Failed", message: "Unauthorized" });
      return;
    }
    if (logo) {
      const boutiksinfo = {
        ...data,
        logo: logo,
      };
      await updateBoutiks(boutiks?._id as unknown as string, boutiksinfo);
      res
        .status(200)
        .json({ status: "Success", message: "Boutiks updated successfully!" });
      return;
    }

    console.log("controller", data);

    await updateBoutiks(boutiks?._id as unknown as string, data);
    res
      .status(200)
      .json({ status: "Success", message: "Boutiks updated successfully!" });
  },
);

const addNewCategorieINBoutiks = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { category_id } = req.body;
    const user = (req as any).user;
    const boutiks = await findBoutiks(user._id);
    if (!user && !boutiks) {
      res.status(401).json({ status: "Failed", message: "Unauthorized" });
      return;
    }
    const newBoutiksInfo = await addNewCategorie(boutiks?._id as unknown as string,category_id);
    if(!newBoutiksInfo){
      res
      .status(400)
      .json({ status: "Success", message: "cannot update boutiks!" });
    }

    res
    .status(200)
    .json({ status: "Success", message: "Boutiks updated successfully!" });
  },
);

export { storeBoutiksInfo, getBoutiksInfo, deleteBoutiks, updateBoutiksInfo,addNewCategorieINBoutiks };
