import { Router } from "express";
import { auth } from "../middleware/auth.middleware";
import { addProfilePicture, deleteAcount, getUserInfo, updateUserInfo } from "../controller/user.controller";
import { upload_single_image } from "../middleware/upload_single_image.middleware";

const userRouter = Router();

userRouter.get("/user/userInfo", auth, getUserInfo);
userRouter.delete("/user",auth,deleteAcount);
userRouter.put("/user/profile", auth, upload_single_image, addProfilePicture)
userRouter.put("/user", auth,updateUserInfo);
export default userRouter;