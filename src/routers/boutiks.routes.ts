import { Router } from "express";
import { auth } from "../middleware/auth.middleware";
import { storeBoutiksInfo } from "../controller/boutiks.controller";
import { upload_single_image } from "../middleware/upload_single_image.middleware";

const boutiksRoutes = Router();
boutiksRoutes.post("/boutiks/store", auth, upload_single_image, storeBoutiksInfo);

export default boutiksRoutes;
