import { Router } from "express";
import { getPersonalInfo, store_personnal_info, updatePersonnalInfo } from "../controller/personnal_info.controller";
import { store_personnal_info_validator } from "../validator/personnal_info.validator";
import validator from "../middleware/validator.middleware";
import { auth } from "../middleware/auth.middleware";
import { uploadMultiImage } from "../middleware/upload_single_image.middleware";

const personnal_info_routes = Router();
personnal_info_routes.post("/personnal/store",store_personnal_info_validator, validator,auth,store_personnal_info)
personnal_info_routes.get("/personnal/info",auth,getPersonalInfo);
personnal_info_routes.put("/personnal/info",auth,uploadMultiImage,updatePersonnalInfo);
export default personnal_info_routes;
