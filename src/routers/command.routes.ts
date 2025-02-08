import { Router } from "express";
import { addNewCommande, getAllCommand, removeCommand, updateCommande } from "../controller/commande.controller";
import { auth } from "../middleware/auth.middleware";

const command_routes = Router();
command_routes.get("/command/:id?", auth,getAllCommand)
command_routes.post("/command", auth,addNewCommande)
command_routes.put("/command/:id", auth,updateCommande)
command_routes.delete("/command/:id", auth, removeCommand);
export default command_routes;