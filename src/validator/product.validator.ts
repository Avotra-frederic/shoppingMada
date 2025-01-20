import { body } from "express-validator";

const product_validator = [
  body("name").notEmpty().withMessage("Product name is required"),
  body("description").notEmpty().withMessage("Product description is required"),
  body("details").notEmpty().withMessage("Prodcut details is required"),
  body("price")
    .notEmpty()
    .withMessage("Product price is required")
    .isNumeric()
    .withMessage("Product price must be a number"),
  body("category").notEmpty().withMessage("Product category is required"),
  body("stock").isNumeric().withMessage("Product stock must be a number")
];
const variant_validator = [
    body("name").notEmpty().withMessage("Product variant name is required"),
    body("values").notEmpty().withMessage("Product variant values is required").isArray().withMessage("Product variant types must be an array"),
]
export {product_validator, variant_validator};