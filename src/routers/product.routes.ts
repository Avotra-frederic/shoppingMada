import { Router } from "express";
import { addNewVariant, deleteBoutiksProduct, getProduct, storeProduct } from "../controller/product.controller";
import { auth } from "../middleware/auth.middleware";
import { uploadMultiImage } from "../middleware/upload_single_image.middleware";
import { csrfProtection } from "../config/app";

const productRoutes = Router();
productRoutes.get("/shop/product/:id?", auth,getProduct);
productRoutes.delete("/shop/product/:id", auth,deleteBoutiksProduct);
productRoutes.get("/shop/:category?/product/:id?",getProduct);
productRoutes.post("/product", auth, uploadMultiImage, storeProduct);
productRoutes.post("/product/:id/variant",auth, addNewVariant);
export default productRoutes;