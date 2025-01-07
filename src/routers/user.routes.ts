import { Router } from "express";
import { auth } from "../middleware/auth.middleware";
import { getUserInfo } from "../controller/user.controller";

const userRouter = Router();

userRouter.get("/user/userInfo", auth, getUserInfo);

export default userRouter;