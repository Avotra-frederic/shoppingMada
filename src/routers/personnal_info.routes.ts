import { Router } from "express";
import { store_personnal_info } from "../controller/personnal_info.controller";
import { store_personnal_info_validator } from "../validator/personnal_info.validator";
import validator from "../middleware/validator.middleware";
import { auth } from "../middleware/auth.middleware";

const personnal_info_routes = Router();
personnal_info_routes.post("/personnal/store", store_personnal_info_validator, validator ,auth,store_personnal_info)

export default personnal_info_routes;
