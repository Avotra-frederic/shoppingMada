import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import IBoutiks from "../interface/boutiks.interface";
import { create_boutiks } from "../service/boutiks.service";

const storeBoutiksInfo = expressAsyncHandler(async(req: Request, res: Response)=>{
    const data : IBoutiks = req.body;
    try {
        Object.assign(data, {owner_id: (req as any).user._id});
        if ((req as any).fileName) {
            data.logo = (req as any).fileName;
        } else {
            res.status(400).json({ status: 'Failed', message: 'Logo is required' });
            return;
        }
        const createBoutiks = await create_boutiks(data);
        if(!createBoutiks){
            res.status(401).json({status:'Failed', message:'Cannot create Boutiks, please try later.'});
            return;
        }
        res.status(201).json({status:"Success", message:"Boutiks created successfully!"});
    } catch (error) {
        throw error;
    }
})

export {storeBoutiksInfo}
