import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import IBoutiks from "../interface/boutiks.interface";
import { create_boutiks, delete_boutiks, findBoutiks, updateBoutiks} from "../service/boutiks.service";
import { findUserGroupId } from "../service/user_group.service";
import { change_user_group } from "../service/user_group_member.service";
import { Types } from "mongoose";

const 
storeBoutiksInfo = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const data: IBoutiks = req.body;
    try {
      Object.assign(data, { owner_id: (req as any).user._id });
      if ((req as any).fileName) {
        data.logo = (req as any).fileName;
      } else {
        res.status(400).json({ status: "Failed", message: "Logo is required" });
        return;
      }
      const createBoutiks = await create_boutiks(data);
      if (!createBoutiks) {
        res
          .status(401)
          .json({
            status: "Failed",
            message: "Cannot create Boutiks, please try later.",
          });
        return;
      }
      const userGroup = await findUserGroupId("Boutiks");
      if (!userGroup) {
        res
          .status(400)
          .json({
            status: "Failed",
            message: "Cannot find user group, please try later.",
          });
        return;
      }
      const updateUser = await change_user_group({
        user_id: (req as any).user._id,
        newusergroup_id: userGroup?._id as Types.ObjectId,
      });
      if (!updateUser) {
        await delete_boutiks(createBoutiks?._id as unknown as string);
        res
          .status(402)
          .json({
            status: "Failed",
            message: "Cannot update user group, please try later.",
          });
        return;
      }
      res
        .status(201)
        .json({ status: "Success", message: "Boutiks created successfully!" });
    } catch (error) {
      throw error;
    }
  },
);

const getBoutiksInfo = expressAsyncHandler(async(req: Request, res: Response)=>{
  const user =(req as any).user;
  if(!user){
    res.status(401).json({status:"Failed", message:"Unauthorized"});
    return;
  }

  const boutiks = await findBoutiks(user._id);
  if(!boutiks){
    res.status(400).json({status:"Failed", message:"Cannot find boutiks"});
    return;
  }

  res.status(200).json({status:"Success",boutiks});
})

const deleteBoutiks = expressAsyncHandler(async(req: Request, res: Response)=>{
  const user = (req as any).user;
  const boutiks = await findBoutiks(user._id);

  if(!user && !boutiks){
    res.status(401).json({status:"Failed", message:"Unauthorized"});
    return;
  }

  await delete_boutiks(boutiks?._id as unknown as string);

  res.status(200).json({status:"Success", message:"Boutiks deleted successfully!"});
})

const updateBoutiksInfo = expressAsyncHandler(async(req: Request, res: Response)=>{
    const user = (req as any).user;
    const boutiks = await findBoutiks(user._id);
    const data = req.body;
    const logo = (req as any).fileName;

    if(!user && !boutiks){
        res.status(401).json({status:"Failed", message:"Unauthorized"});
        return;
    }
    if(logo){
      const boutiksinfo = {
        ...data,
        logo: logo
      }
      await updateBoutiks(boutiks?._id as unknown as string, boutiksinfo);
      res.status(200).json({status:"Success", message:"Boutiks updated successfully!"});
      return;
    }

    await updateBoutiks(boutiks?._id as unknown as string, data);
    res.status(200).json({status:"Success", message:"Boutiks updated successfully!"});

})

export { storeBoutiksInfo , getBoutiksInfo, deleteBoutiks,updateBoutiksInfo};
