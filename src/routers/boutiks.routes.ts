import { Router } from "express";
import { auth } from "../middleware/auth.middleware";
import { addNewCategorieINBoutiks, deleteBoutiks, getBoutiksInfo, storeBoutiksInfo, updateBoutiksInfo } from "../controller/boutiks.controller";
import { upload_single_image } from "../middleware/upload_single_image.middleware";
import boutiks_store_validator from "../validator/boutiks.validator";
import validator from "../middleware/validator.middleware";

const boutiksRoutes = Router();
boutiksRoutes.post("/boutiks/store", auth, upload_single_image,boutiks_store_validator, validator, storeBoutiksInfo);
boutiksRoutes.get("/boutiks/info",auth,getBoutiksInfo);
boutiksRoutes.put("/boutiks/update",auth, upload_single_image, updateBoutiksInfo);
boutiksRoutes.put("/boutiks",auth, boutiks_store_validator, validator, updateBoutiksInfo);
boutiksRoutes.put("/boutiks/newCategories",auth,addNewCategorieINBoutiks)
boutiksRoutes.delete("/boutiks",auth, deleteBoutiks);
export default boutiksRoutes;
