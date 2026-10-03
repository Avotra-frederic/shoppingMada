import { body } from "express-validator";

const boutiks_store_validator = [
    body("name").notEmpty().withMessage("Le nom de la boutique est obligatoire."),
    body("adresse").notEmpty().withMessage("L’adresse de la boutique est obligatoire."),
    body("phoneNumber")
      .notEmpty()
      .withMessage("Le numéro de téléphone est obligatoire.")
      .matches(/^(?:(\+261)|0)(32|33|34|38|37)\d{7}$/)
      .withMessage("Veuillez saisir un numéro de téléphone valide."),
    body("email")
      .isString()
      .withMessage("L’adresse e-mail doit être une chaîne de caractères.")
      .notEmpty()
      .withMessage("L’adresse e-mail est obligatoire.")
      .matches(
        /^[a-zA-Z0-9._%+-]+@(gmail|yahoo|outlook|[a-zA-Z]{2,}.*)\.(mg|fr|com|org|io|[a-zA-Z]{2,})$/
      )
      .withMessage("Veuillez saisir une adresse e-mail valide."),
    body("product_category").isArray().withMessage("Au moins une catégorie de produits est obligatoire."),
]

export default boutiks_store_validator;