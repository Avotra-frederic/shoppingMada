import { Router } from "express";
import { submitContactMessage } from "../controller/contact.controller";

const contactRoutes = Router();
contactRoutes.post("/contact", submitContactMessage);

export default contactRoutes;