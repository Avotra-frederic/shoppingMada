import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import upload, { uploadImage } from "../config/uploadsingle_multer";

const upload_single_image = expressAsyncHandler(async(req: Request, res: Response, next: NextFunction) => {
    upload(req, res, async(err : any)=>{
        if (err) return next(err);
        if((req as any).file){
            (req as any).fileName = (req as any).file.filename;
            next()
        } else {
            res.status(400).json({ status: "Failed", message: "No file uploaded" });
        }
    });
    
})

const uploadMultiImage = expressAsyncHandler(async(req: Request, res: Response, next: NextFunction) => {
    uploadImage(req, res, async(err : any)=>{
        if (err) return next(err);
        if(req.files){
            (req as any).fileNames = (req.files as Express.Multer.File[]).map(file =>file.filename);
            next()
        } else {
            res.status(400).json({ status: "Failed", message: "No file uploaded" });
        }
    });
})

export {upload_single_image, uploadMultiImage};
