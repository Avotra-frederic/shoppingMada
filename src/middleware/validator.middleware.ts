import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { validationResult } from "express-validator";

 const validator  =  expressAsyncHandler((req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(422).json({ status: "Failed", errors: errors.array() });
        return;
    }
    next();
  })
  export default validator;
