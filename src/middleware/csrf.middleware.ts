import { NextFunction, Request, Response } from "express";
import { default as CSRF } from "csrf";
const csrf = new CSRF();
const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers["xsrf-token"] as string;
  const secret = req.cookies["csrf-secret"] as string;

  if (
    req.method === "POST" ||
    req.method === "PUT" ||
    req.method === "DELETE"
  ) {
    try {
      if (!secret || !csrf.verify(secret, token)) {
        res.status(401).json({ status: "Failed", message: "Unauthorized!" });
      }
      next();
    } catch (error) {
      res.status(401).json({ status: "Failed", message: "Unauthorized!" });
    }
  } else {
    next();
  }
};
export default csrfProtection;
