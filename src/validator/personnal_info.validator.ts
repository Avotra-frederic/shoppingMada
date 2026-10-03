import { body } from "express-validator";

const store_personnal_info_validator = [
  body("firstName")
    .notEmpty()
    .withMessage("Le nom est obligatoire.")
    .isString()
    .withMessage("Le nom doit être une chaîne de caractères.")
    .isLength({ min: 3, max: 30 })
    .withMessage("Le nom doit comporter entre 3 et 30 caractères."),
  body("lastName")
    .notEmpty()
    .withMessage("Le prénom est obligatoire.")
    .isString()
    .withMessage("Le prénom doit être une chaîne de caractères.")
    .isLength({ min: 3, max: 30 })
    .withMessage("Le prénom doit comporter entre 3 et 30 caractères."),
  body("gender")
    .notEmpty()
    .withMessage("Le genre est obligatoire.")
    .isString()
    .withMessage("Le genre doit être une chaîne de caractères."),
  body("adresse").notEmpty().withMessage("L’adresse est obligatoire."),
  body("phoneNumber")
    .notEmpty()
    .withMessage("Le numéro de téléphone est obligatoire.")
    .matches(/^(?:(\+261)|0)(32|33|34|38|37)\d{7}$/)
    .withMessage("Veuillez saisir un numéro de téléphone valide."),
 
];


export {store_personnal_info_validator}
