import { body } from "express-validator";

const registerValidator = [
  body("username")
    .isString()
    .withMessage("Le nom d’utilisateur doit être une chaîne de caractères.")
    .notEmpty()
    .withMessage("Le nom d’utilisateur est obligatoire.")
    .isLength({ min: 3 })
    .withMessage("Le nom d’utilisateur doit comporter entre 3 et 30 caractères."),
  body("phonenumber")
    .notEmpty()
    .withMessage("Le numéro de téléphone est obligatoire.")
    .matches(/^(?:(\+261)|0)(32|33|34|38|37)\d{7}$/)
    .withMessage("Veuillez saisir un numéro de téléphone valide."),
  body("email")
    .isString()
    .withMessage("L’adresse e-mail doit être une chaîne de caractères.")
    .notEmpty()
    .withMessage("L’adresse e-mail est obligatoire.")
    .isEmail()
    .withMessage("Veuillez saisir une adresse e-mail valide.")
    .normalizeEmail(),
  body("password")
    .isStrongPassword({
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    })
    .withMessage(
      "Le mot de passe doit comporter au moins 8 caractères et inclure une majuscule, une minuscule, un chiffre et un caractère spécial."
    ),
];



export { registerValidator };
