import { Request, Response, NextFunction } from "express";
import expressAsyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

export const verifyToken = expressAsyncHandler( (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.token;
  
    if (!token) {
      res.status(401).json({ message: "Non authentifié" });
      return;
    }
  
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      (req as any).user = decoded;
      next();
    } catch (err) {
      res.status(403).json({ message: "Token invalide ou expiré" });
      return;
    }
  });
