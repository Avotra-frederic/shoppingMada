import jwt, { JwtPayload } from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";

const auth = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.cookies.jwt;

    if (!token) {
      res.status(401).json({
        status: "Unauthorized",
        message: "Access denied!",
      });
      return;
    }

    try {
      const decodedToken = jwt.verify(
        token,
        process.env.TOKEN_SECRET as string,
        { ignoreExpiration: true } 
      ) as JwtPayload;

      const currentTime = Math.floor(Date.now() / 1000); 
      const isExpired = decodedToken.exp! <= currentTime;

      if (isExpired) {
        const newToken = jwt.sign(
          { _id: decodedToken._id, email: decodedToken.email, username:decodedToken.username, phonenumber: decodedToken.phonenumber }, 
          process.env.TOKEN_SECRET as string,
          { expiresIn: "1h" } 
        );
        res.cookie("jwt", newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production", 
          sameSite: "strict",
        });
        console.log("Nouveau token généré et envoyé au client.");
      }

  
      (req as any).user = decodedToken;
      next();
    } catch (error) {
      console.error("Erreur lors de la vérification du token :", error);
      res.status(401).json({ status: "Unauthorized", message: "Invalid token!" });
    }
  }
);


const guest = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.cookies.jwt;
    if (token) {
      res
        .status(402)
        .json({ status: "Unauthorized", message: "Access denied!" });
      return;
    }
    next();
  },
);
export { auth, guest };
