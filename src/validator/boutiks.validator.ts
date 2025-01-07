import { body } from "express-validator";

const boutiks_store_validator = [
    body("name").notEmpty().withMessage("name is required"),
    body("adresse").notEmpty().withMessage("adresse is required"),
    body("phoneNumber")
      .notEmpty()
      .withMessage("Phonenumber is required")
      .matches(/^(?:(\+261)|0)(32|33|34|38|37)\d{7}$/)
      .withMessage("Please enter a valid phone number"),
    body("email")
      .isString()
      .withMessage("Email adresse must be a string")
      .notEmpty()
      .withMessage("email addresse is required")
      .matches(
        /^[a-zA-Z0-9._%+-]+@(gmail|yahoo|outlook|[a-zA-Z]{2,}.*)\.(mg|fr|com|org|io|[a-zA-Z]{2,})$/
      )
      .withMessage("please enter a valid email"),
    body("product_category").isArray().withMessage("product_category is required"),
]

export default boutiks_store_validator;