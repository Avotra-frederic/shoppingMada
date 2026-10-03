import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import IPersonalInfo from "../interface/personnal_info.interface";
import { completPersonnalInfo, create_personnal_info, get_personnal_info_by_owner_id } from "../service/personnel_info.service";
import { getUser, updateUser } from "../service/user.service";
import { ObjectId, Schema, Types } from "mongoose";
import IUser from "../interface/user.interface";

const store_personnal_info= expressAsyncHandler(async(req: Request, res: Response, next: NextFunction)=>{
   
    try {
        const data: IPersonalInfo = req.body;
        Object.assign(data, {owner_id: (req as any).user._id});
        const personnalInfo = await create_personnal_info(data);
        if(!personnalInfo){
            res.status(401).json({status: "Failed", message:"Impossible d’enregistrer vos informations personnelles."});
            return;
        }
        const newUser = await updateUser((req as any).user._id,{personnalInfo_id: new Types.ObjectId(personnalInfo._id as string)} as IUser);
        if(!newUser)
        {
            res.status(400).json({message:"Impossible de mettre à jour le compte. Veuillez réessayer."});
            return
        }
        const updatedUser = await getUser(String(newUser._id));
        if (!updatedUser) {
            res.status(500).json({status: "Failed", message: "Le profil a été enregistré, mais son actualisation a échoué."});
            return;
        }

        const { password: _password, ...userInfo } = updatedUser;
        res.status(201).json({status:"Success", message:"Vos informations personnelles ont été enregistrées.", userInfo});
    } catch (error) {
        next(error);
    }
});


const getPersonalInfo = expressAsyncHandler(async(req: Request, res:Response)=>{
    const personnalInfo = await get_personnal_info_by_owner_id((req as any).user._id);
    if(!personnalInfo){
        res.status(201).json({status:"Success", data: null});
        return;
    };
    res.status(201).json({status:"Success", data: personnalInfo});
});

const updatePersonnalInfo = expressAsyncHandler(async(req: Request, res:Response)=>{
    const data = req.body;
    const fileNames = (req as any).fileNames ?? [];
    const [frontImage, backImage] = fileNames;
    const newData ={...data, frontImage, backImage}
    const updatePersonnalInfo = await completPersonnalInfo((req as any).user._id, newData);
    if(!updatePersonnalInfo){
        res.status(201).json({status:"Success", data: null});
        return;
    };

    
    res.status(201).json({status:"Success", data: updatePersonnalInfo});
})
export {store_personnal_info, getPersonalInfo, updatePersonnalInfo};
