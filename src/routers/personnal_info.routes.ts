import { Router } from "express";
import { decideKyc, getKycDocument, getPersonalInfo, listKycForAdmin, store_personnal_info, updatePersonnalInfo } from "../controller/personnal_info.controller";
import { store_personnal_info_validator } from "../validator/personnal_info.validator";
import validator from "../middleware/validator.middleware";
import { auth } from "../middleware/auth.middleware";
import { uploadKycImageFiles } from "../middleware/upload_single_image.middleware";
import requireAdminStepUp from "../middleware/admin-step-up.middleware";

const personnal_info_routes = Router();
personnal_info_routes.post("/personnal/store",store_personnal_info_validator, validator,auth,store_personnal_info)
personnal_info_routes.get("/personnal/info",auth,getPersonalInfo);
personnal_info_routes.put("/personnal/info",auth,uploadKycImageFiles,updatePersonnalInfo);
personnal_info_routes.get("/admin/kyc", auth, listKycForAdmin);
personnal_info_routes.put("/admin/kyc/:id", auth, requireAdminStepUp, decideKyc);
personnal_info_routes.get("/admin/kyc/:id/documents/:side", auth, getKycDocument);
export default personnal_info_routes;
