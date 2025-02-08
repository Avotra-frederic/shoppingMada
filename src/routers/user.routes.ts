import { Router } from "express";
import { auth } from "../middleware/auth.middleware";
import { activeAccount, addProfilePicture, all, blockAccount, changeUserGroupToAdmin, checkUserAccount, deleteAcount, findUser, getUserInfo, updateUserInfo } from "../controller/user.controller";
import { upload_single_image } from "../middleware/upload_single_image.middleware";

const userRouter = Router();

userRouter.get("/user/userInfo", auth, getUserInfo);
userRouter.delete("/user",auth,deleteAcount);
userRouter.put("/user/profile", auth, upload_single_image, addProfilePicture)
userRouter.put("/user", auth,updateUserInfo);
userRouter.get("/users",auth,all);
userRouter.get("/user/:id", auth, findUser);
userRouter.get("/account/status/:id",auth,checkUserAccount)
userRouter.put("/account/:id/block", auth, blockAccount)
userRouter.put("/account/:id/active", auth, activeAccount)
userRouter.put("/account/:id/admin", auth, changeUserGroupToAdmin)
export default userRouter;