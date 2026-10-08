import { Router } from "express";
import { auth } from "../middleware/auth.middleware";
import { addNewComment, getComment, listCommentsForModeration, moderateCommentStatus, moderateCommentsInBulk, removeComment } from "../controller/comment.controller";
import requireAdminStepUp from "../middleware/admin-step-up.middleware";

const commentRoutes = Router();

commentRoutes.get("/admin/comments", auth, listCommentsForModeration);
commentRoutes.put("/admin/comments/:id/moderation", auth, requireAdminStepUp, moderateCommentStatus);
commentRoutes.put("/admin/comments/moderation/bulk", auth, requireAdminStepUp, moderateCommentsInBulk);
commentRoutes.post("/comment", auth, addNewComment);
commentRoutes.get("/comment/:id", getComment);
commentRoutes.delete("/comment/:id", auth, removeComment);
export default commentRoutes;