import { body } from "express-validator";

const product_validator = [
  body("name").notEmpty().withMessage("Le nom du produit est obligatoire."),
  body("description").notEmpty().withMessage("La description du produit est obligatoire."),
  body("details").notEmpty().withMessage("Les détails du produit sont obligatoires."),
  body("price")
    .notEmpty()
    .withMessage("Le prix du produit est obligatoire.")
    .isNumeric()
    .withMessage("Le prix du produit doit être un nombre."),
  body("category").notEmpty().withMessage("La catégorie du produit est obligatoire."),
  body("stock").isNumeric().withMessage("Le stock doit être un nombre.")
];
const variant_validator = [
    body("name").notEmpty().withMessage("Le nom de la variante est obligatoire."),
    body("values").notEmpty().withMessage("Les valeurs de la variante sont obligatoires.").isArray().withMessage("Les valeurs de la variante doivent être fournies sous forme de tableau."),
]
export {product_validator, variant_validator};