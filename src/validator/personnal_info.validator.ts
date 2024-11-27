import { body } from "express-validator";

const store_personnal_info_validator = [
  body("firstName")
    .notEmpty()
    .withMessage("firstname is required!")
    .isString()
    .withMessage("firstname must be a string")
    .isLength({ min: 3 })
    .withMessage("firstname must be between 3 and 30 character long"),
  body("lastName")
    .notEmpty()
    .withMessage("lastname is required!")
    .isString()
    .withMessage("lastname must be a string")
    .isLength({ min: 3 })
    .withMessage("lastname must be between 3 and 30 character long"),
  body("gender")
    .notEmpty()
    .withMessage("Gender is required!")
    .isString()
    .withMessage("Gender must be a string"),
  body("adresse").notEmpty().withMessage("Adresse is required!"),
];


export {store_personnal_info_validator}
