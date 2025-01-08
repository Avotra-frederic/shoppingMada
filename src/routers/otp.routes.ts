import { Router } from "express";
import { auth } from "../middleware/auth.middleware";
import { getNewOTP, verifyOTPCode } from "../controller/OTP.controller";

const otpRoutes = Router();
otpRoutes.post("/email/verify",auth,verifyOTPCode);
otpRoutes.get("/email/new_verification_code",auth,getNewOTP);
export default otpRoutes;
