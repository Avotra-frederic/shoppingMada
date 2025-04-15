import { NextFunction, Request, Response } from "express";
import { default as CSRF } from "csrf";
import expressAsyncHandler from "express-async-handler";
const csrf = new CSRF();
const csrfProtection = expressAsyncHandler(async(req: Request, res: Response, next: NextFunction) => {
  const token = req.headers["xsrf-token"] as string;
  const secret = req.cookies["csrf-secret"] as string;
  if (
    req.method === "POST" ||
    req.method === "PUT" ||
    req.method === "DELETE"
  ) {
    if (!secret || !csrf.verify(secret, token)) {
      res.status(419).json({ status: "Failed", message: "Unauthorized!" });
      return;
    }
    next();
  } else {
    next();
  }
});
export default csrfProtection;
