import { Router } from "express";
import { addNewVariant, deleteBoutiksProduct, getProduct, removeVariant, search_product, storeProduct, updateProductVariant } from "../controller/product.controller";
import { auth } from "../middleware/auth.middleware";
import { uploadMultiImage } from "../middleware/upload_single_image.middleware";
import { product_validator, variant_validator } from "../validator/product.validator";
import validator from "../middleware/validator.middleware";

const productRoutes = Router();
productRoutes.get("/boutiks/product/:id?", auth,getProduct);
productRoutes.delete("/shop/product/:id", auth,deleteBoutiksProduct);
productRoutes.get("/shop/:category?/product/:id?",getProduct);
productRoutes.post("/product", auth, uploadMultiImage, product_validator, validator, storeProduct);
productRoutes.put("/product/:id", auth, uploadMultiImage, product_validator, validator, storeProduct);
productRoutes.post("/product/:id/variant",auth,variant_validator, validator, addNewVariant);
productRoutes.delete("/product/:id/variant/:variant_id/:valueName",auth,removeVariant);
productRoutes.put("/product/:id/variant/variant_id",auth,updateProductVariant);
productRoutes.get("/product/search",search_product);
export default productRoutes;