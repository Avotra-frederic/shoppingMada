
import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { getOTP } from "../helpers/OTP.algo";
import { verifyEmailUser } from "../service/user.service";
interface IOTP{
    OTP:string;
}
const verifyOTPCode = expressAsyncHandler(async(req: Request, res:Response)=>{
    const {OTP}: IOTP = req.body;
    if(OTP.trim() !== getOTP((req as any).user.email)){
        res.status(401).json({status:"Failed", message:"Invalid OTP code"});
        return;
    }

    const userUpdate = await verifyEmailUser((req as any).user._id);
    if(!userUpdate){
        res.status(401).json({status:"Failed", message:"An error as occured!"});
        return;
    }

    res.status(201).json({status:"Success", message:"Email verified successfully!"});
});

const getNewOTP = expressAsyncHandler(async (req: Request, res:Response)=>{
    const OTP = getOTP((req as any).user.email);
    res.status(201).json({status:"Succes", message:"A new OTP Code is sent in your email adresse", OTP});
})

export {verifyOTPCode, getNewOTP};
