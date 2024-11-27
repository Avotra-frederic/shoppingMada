import jwt, { JwtPayload }  from 'jsonwebtoken';
import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { header } from 'express-validator';

const auth = expressAsyncHandler(async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.headers["authorization"]?.split(" ")[1];
    if(!token){
        res.status(401).json({ status:"Unauthorized", message:"Access denied masosopory!", header:req.headers["authorization"]});
        return;
    }
    try {
        const decodedtoken = jwt.verify(token, process.env.TOKEN_SECRET as string) as JwtPayload;
        ( req as any).user = decodedtoken;
        next();
    } catch (error) {
        throw error
    }
})

const guest = expressAsyncHandler(async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.headers["authorization"]?.split(" ")[1];
    if(token){
        res.status(401).json({ status:"Unauthorized", message:"Access denied!"});
        return;
    }
    next();
})
export {auth,guest};
