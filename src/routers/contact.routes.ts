import { Router } from "express";
import { listContactTickets, submitContactMessage, updateContactTicket, replyToContactTicket, listMyContactTickets, replyToMyContactTicket } from "../controller/contact.controller";
import { auth } from "../middleware/auth.middleware";
import optionalAuth from "../middleware/optional-auth.middleware";

const contactRoutes = Router();
contactRoutes.post("/contact", optionalAuth, submitContactMessage);
contactRoutes.get("/contact/my-tickets", auth, listMyContactTickets);
contactRoutes.post("/contact/my-tickets/:id/replies", auth, replyToMyContactTicket);
contactRoutes.get("/admin/contact-tickets", auth, listContactTickets);
contactRoutes.put("/admin/contact-tickets/:id", auth, updateContactTicket);
contactRoutes.post("/admin/contact-tickets/:id/replies", auth, replyToContactTicket);

export default contactRoutes;
