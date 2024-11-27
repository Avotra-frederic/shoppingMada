import { Router } from "express";
import { login, storeUser } from "../controller/user.controller";
import { registerValidator } from "../validator/user.validator";
import validator from "../middleware/validator.middleware";
import { guest } from "../middleware/auth.middleware";

const authRoutes = Router();

authRoutes.post("/auth/register",registerValidator, validator, guest,storeUser)
authRoutes.post("/auth/login",guest,login);

export default authRoutes;
