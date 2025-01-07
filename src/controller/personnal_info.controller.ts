import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import IPersonalInfo from "../interface/personnal_info.interface";
import { completPersonnalInfo, create_personnal_info, get_personnal_info_by_owner_id } from "../service/personnel_info.service";

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
        console.log(error, "mon error");
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
    const fileNames = (req as any).fileNames;
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
