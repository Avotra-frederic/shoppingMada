import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import upload from "../config/uploadsingle_multer";

const upload_single_image = expressAsyncHandler(async(req: Request, res: Response, next: NextFunction) => {
    upload(req, res, async(err : any)=>{
        if (err) return next(err);
        if((req as any).file){
            console.log((req as any).file);
            (req as any).fileName = (req as any).file.filename;
            next()
        } else {
            res.status(400).json({ status: "Failed", message: "No file uploaded" });
        }
    });
    // next();
})

export {upload_single_image};
