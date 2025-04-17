import { verifyToken } from './../middleware/verifytoken.middleware';
import { Router } from "express";
import { authVerify, handleChangePassword, login, logout, regenerateToken, storeUser } from "../controller/user.controller";
import { registerValidator } from "../validator/user.validator";
import validator from "../middleware/validator.middleware";
import { auth, guest } from "../middleware/auth.middleware";
const authRoutes = Router();

authRoutes.post("/auth/register",registerValidator,validator,storeUser)
authRoutes.post("/auth/login",guest,login);
authRoutes.post("/auth/refresh",auth,regenerateToken);
authRoutes.post("/auth/logout",auth, logout);
authRoutes.post("/auth/forgotpassword",handleChangePassword);
authRoutes.get("/auth/me",verifyToken,authVerify)

export default authRoutes;
