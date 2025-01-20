import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import IProduct from "../interface/product.interface";
import { create_product, getAllProductInCategory, getAllProduct, getProductById, addProductVariant, getBoutiksProduct, deleteProduct, deleteVariant, updateVariant } from "../service/product.service";
import path from "path";
import fs from "fs"

const storeProduct = expressAsyncHandler(async(req: Request, res:Response)=>{
    const data : IProduct = req.body;
    const fileNames = (req as any).fileNames;
    const newData = {...data, owner_id: (req as any).user._id, photos: fileNames};
    const product = await create_product(newData as IProduct);
    if(!product){
        res.status(400).json({status:"Failed", message:"Failed to save product! Please try again"});
        return;
    }
    res.status(201).json({status: "Success", message :"Product save successfully !"});
})

const getProduct = expressAsyncHandler(async(req: Request, res: Response)=>{
    const {category, id} = req.params

    const user = (req as any).user;
    if( user && !id){
        const product = await getBoutiksProduct(user._id);
        res.status(200).json({status:"Success", data: product});
        return;
    }
    if(id){
        const product = await getProductById(id);
        res.status(200).json({status:"Success", data: product});
        return;
    }

    if(category){
        const product = await getAllProductInCategory(category);
        res.status(200).json({status:"Success", data: product});
        return;
    }
    
    const product = await getAllProduct();
    res.status(200).json({status:"Success", data: product});
})

const addNewVariant = expressAsyncHandler(async(req: Request, res: Response)=>{
    const {id} = req.params
    if(!id){
        res.status(401).json({status:"Failed",message:"Unauthorized!"})
    }
    const data = req.body;
    const variant = await addProductVariant(id,data);
    if(!variant){
        res.status(400).json({status:"Failed",message:"An error as occured! please try again later"});
        return;
    }

    res.status(201).json({status:"Success", message:"Product variant is added successfully!"});
})

const deleteBoutiksProduct = expressAsyncHandler(async(req: Request, res: Response)=>{
    const {id} = req.params;
    const user = (req as any).user;
    if(!user){
        res.status(401).json({status:"Failed", message:"Unauthorized"});
        return;
    }

    const product = await getBoutiksProduct(user._id);
    if(!product){
        res.status(404).json({status:"Failed", message:"Cannot find product! please try again or contact your admistrator"});
        return;
    }

    product.photos.forEach((photo: string, index: number) => {
        const imagePath = path.join(__dirname,"../..", "public", "uploads", product.photos[index]);
        fs.unlink(imagePath, (err) => {
            if(err){
                console.log(err);
            }
        })
    })

    const newProduct = await deleteProduct(id);
    if(!newProduct){
        res.status(400).json({status:"Failed", message:"An error as occured! please try again later"});
        return;
    }

    res.status(201).json({status:"Success", message:"Product deleted successfully!", data: newProduct});


})

const removeVariant = expressAsyncHandler(async(req: Request, res: Response)=>{
    const {id, variant_id}= req.params;
    const user = (req as any).user;
    if(!user){
        res.status(401).json({status:"Failed", message:"Unauthorized"});
        return;
    }
    const product = await deleteVariant(id, variant_id);
    if(!product){
        res.status(400).json({status:"Failed", message:"An error as occured! please try again later"});
        return;
    }

    res.status(201).json({status:"Success", message:"Product deleted successfully!", data: product});
})

const updateProductVariant = expressAsyncHandler(async(req: Request, res: Response)=>{
    const {id, variant_id} = req.params;
    const data = req.body;
    const variant = await updateVariant(id, variant_id, data);
    if(!variant){
        res.status(400).json({status:"Failed",message:"An error as occured! please try again later"});
        return;
    }

    res.status(201).json({status:"Success", message:"Product variant is added successfully!"});
})

export {storeProduct, getProduct,addNewVariant, deleteBoutiksProduct, removeVariant, updateProductVariant};