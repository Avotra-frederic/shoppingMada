import { Router } from "express";
import { auth } from "../middleware/auth.middleware";
import { getBoutiksInfo, storeBoutiksInfo } from "../controller/boutiks.controller";
import { upload_single_image } from "../middleware/upload_single_image.middleware";
import boutiks_store_validator from "../validator/boutiks.validator";
import validator from "../middleware/validator.middleware";
import { csrfProtection } from "../config/app";

const boutiksRoutes = Router();
boutiksRoutes.post("/boutiks/store", auth, upload_single_image,boutiks_store_validator, validator, storeBoutiksInfo);
boutiksRoutes.get("/boutiks/info",auth,getBoutiksInfo);
export default boutiksRoutes;
