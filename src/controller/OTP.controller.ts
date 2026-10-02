
import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { createEmailOtp, verifyEmailOtp } from "../service/user.service";
import jwt from "jsonwebtoken";
import sendEmail from "../helpers/mail";
import bcrypt from "bcryptjs";
import { updateUser } from "../service/user.service";
const verifyOTPCode = expressAsyncHandler(async(req: Request, res:Response)=>{
    const OTP = req.body.OTP;
    const user = (req as any).user;
    const userUpdate = await verifyEmailOtp(String(user._id), String(OTP ?? "").trim());
    if(!userUpdate){
        res.status(403).json({status:"Failed", message:"Invalid OTP code"});
        return;
    }

    if ((req as any).user.tokenPurpose === "email-verification") {
        const { tokenPurpose: _tokenPurpose, iat: _iat, exp: _exp, ...authUser } = (req as any).user;
        const token = jwt.sign(authUser, process.env.TOKEN_SECRET as string, { expiresIn: "1h" });
        res.cookie("jwt", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });
    } else if ((req as any).user.tokenPurpose === "password-reset") {
        const { iat: _iat, exp: _exp, ...authUser } = (req as any).user;
        const token = jwt.sign({ ...authUser, otpVerified: true }, process.env.TOKEN_SECRET as string, { expiresIn: "10m" });
        res.cookie("jwt", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 10 * 60 * 1000,
        });
    }

    res.status(201).json({status:"Success", message:"Email verified successfully!"});
});

const getNewOTP = expressAsyncHandler(async (req: Request, res:Response)=>{
    const user = (req as any).user;
    const OTP = await createEmailOtp(String(user._id));
    await sendEmail({
        title: "V�rification de votre adresse email",
        message: "Voici votre nouveau code de v�rification.",
        information: `Code : ${OTP}`,
        content: "Ce code expire dans 10 minutes.",
    }, user.email, "Votre code de v�rification");
    res.status(200).json({status:"Success", message:"Un nouveau code a �t� envoy� � votre adresse email."});
})

const resetPassword = expressAsyncHandler(async (req: Request, res: Response) => {
    const password = String(req.body.password ?? "");
    if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
        res.status(400).json({ status: "Failed", message: "Le mot de passe doit contenir 8 caract�res, une majuscule, une minuscule, un chiffre et un symbole." });
        return;
    }
    const user = (req as any).user;
    const updated = await updateUser(String(user._id), { password: await bcrypt.hash(password, 10) } as any);
    if (!updated) {
        res.status(400).json({ status: "Failed", message: "Impossible de modifier le mot de passe." });
        return;
    }
    res.clearCookie("jwt", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" });
    res.status(200).json({ status: "Success", message: "Mot de passe r�initialis� avec succès." });
});

export {verifyOTPCode, getNewOTP, resetPassword};
