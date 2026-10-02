import { body } from "express-validator";

const registerValidator = [
  body("username")
    .isString()
    .withMessage("Username must be a string!")
    .notEmpty()
    .withMessage("username is required")
    .isLength({ min: 3 })
    .withMessage("username must be between 3 and 30 character long"),
  body("phonenumber")
    .notEmpty()
    .withMessage("Phonenumber is required")
    .matches(/^(?:(\+261)|0)(32|33|34|38|37)\d{7}$/)
    .withMessage("Please enter a valid phone number"),
  body("email")
    .isString()
    .withMessage("Email adresse must be a string")
    .notEmpty()
    .withMessage("email addresse is required")
    .isEmail()
    .withMessage("please enter a valid email")
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
      "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character."
    ),
];



export { registerValidator };
