import { Router } from "express";
import { auth } from "../middleware/auth.middleware";
import { addNewComment, getComment, listCommentsForModeration, moderateCommentStatus, removeComment } from "../controller/comment.controller";

const commentRoutes = Router();

commentRoutes.get("/admin/comments", auth, listCommentsForModeration);
commentRoutes.put("/admin/comments/:id/moderation", auth, moderateCommentStatus);
commentRoutes.post("/comment", auth, addNewComment);
commentRoutes.get("/comment/:id", getComment);
commentRoutes.delete("/comment/:id", auth, removeComment);
export default commentRoutes;