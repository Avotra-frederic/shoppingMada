import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { validationResult } from "express-validator";

 const validator  =  expressAsyncHandler(async(req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const details = errors.array();
        res.status(400).json({
            status: "Failed",
            message: details.map((error) => error.msg).join(" "),
            errors: details,
        });
        return;
    }
    next();
  })
  export default validator;
