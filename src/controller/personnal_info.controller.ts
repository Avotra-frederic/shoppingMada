import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import IPersonalInfo from "../interface/personnal_info.interface";
import { create_personnal_info } from "../service/personnel_info.service";

const store_personnal_info= expressAsyncHandler(async(req: Request, res: Response, next: NextFunction)=>{
    try {
        const data: IPersonalInfo = req.body;
        Object.assign(data, {owner_id: (req as any).user._id});
        const personnalInfo = await create_personnal_info(data);
        if(!personnalInfo){
            res.status(401).json({status: "Failed", message:"Couldn't to add personnal info!"});
            return;
        }
        res.status(201).json({status:"Success", message:"Personnal info saved successfully"});
    } catch (error) {
        console.log(error);
        
        next(error)
    }
});
export {store_personnal_info};
