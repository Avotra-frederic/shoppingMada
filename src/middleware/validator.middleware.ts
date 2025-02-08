import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { validationResult } from "express-validator";

 const validator  =  expressAsyncHandler(async(req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req.body);
    if (!errors.isEmpty()) {
        res.status(400).json({ status: "Failed", errors: errors.array() });
        return;
    }
    next();
  })
  export default validator;
