import { Router } from "express";
import { auth } from "../middleware/auth.middleware";
import { addNewComment, getComment, removeComment } from "../controller/comment.controller";

const commentRoutes = Router();

commentRoutes.post("/comment", auth, addNewComment);
commentRoutes.get("/comment/:id", getComment);
commentRoutes.delete("/comment/:id", auth, removeComment);
export default commentRoutes;