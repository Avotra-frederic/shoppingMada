import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import upload, { uploadImage, uploadKycImages, uploadProductImages } from "../config/uploadsingle_multer";

const normalizeBoutikCategories = (req: Request) => {
    const value = req.body?.product_category;
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            req.body.product_category = Array.isArray(parsed) ? parsed : [];
        } catch {
            req.body.product_category = [];
        }
    }
};

const upload_single_image = expressAsyncHandler(async(req: Request, res: Response, next: NextFunction) => {
    upload(req, res, async(err : any)=>{
        if (err) return next(err);
        if((req as any).file){
            (req as any).fileName = (req as any).file.filename;
            normalizeBoutikCategories(req);
            next()
        } else {
            normalizeBoutikCategories(req);
            next();
        }
    });
    
})

const uploadMultiImage = expressAsyncHandler(async(req: Request, res: Response, next: NextFunction) => {
    uploadImage(req, res, async(err : any)=>{
        if (err) return next(err);
        const files = req.files as Express.Multer.File[] | undefined;
        if(files?.length === 2){
            (req as any).fileNames = files.map(file =>file.filename);
            next()
        } else {
            res.status(400).json({ status: "Failed", message: "Les photos du recto et du verso sont obligatoires." });
        }
    });
})

const uploadKycImageFiles = expressAsyncHandler(async(req: Request, res: Response, next: NextFunction) => {
    uploadKycImages(req, res, async(err: any) => {
        if (err) return next(err);
        const files = req.files as Express.Multer.File[] | undefined;
        if (files?.length === 2) {
            (req as any).fileNames = files.map((file) => file.filename);
            next();
        } else {
            res.status(400).json({ status: "Failed", message: "Les photos du recto et du verso sont obligatoires." });
        }
    });
});

const uploadProductImageFiles = expressAsyncHandler(async(req: Request, res: Response, next: NextFunction) => {
    uploadProductImages(req, res, async(err: any) => {
        if (err) return next(err);
        (req as any).fileNames = (req.files as Express.Multer.File[] | undefined)?.map(file => file.filename) ?? [];
        next();
    });
});

export {upload_single_image, uploadMultiImage, uploadKycImageFiles, uploadProductImageFiles};
