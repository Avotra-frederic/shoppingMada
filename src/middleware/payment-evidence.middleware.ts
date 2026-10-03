import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { uploadPaymentEvidence } from "../config/uploadsingle_multer";

const paymentEvidence = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    uploadPaymentEvidence(req, res, (error: any) => {
      if (error) return next(error);
      next();
    });
  },
);

export default paymentEvidence;