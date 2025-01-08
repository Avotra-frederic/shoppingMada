import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import expressAsyncHandler from "express-async-handler";
import authRoutes from "../routers/auth.routes";
import personnal_info_routes from "../routers/personnal_info.routes";
import otpRoutes from "../routers/otp.routes";
import boutiksRoutes from "../routers/boutiks.routes";
import path from "path";
import productRoutes from "../routers/product.routes";
import csrfProtection from "../middleware/csrf.middleware";
import mongoSanitize from "express-mongo-sanitize";
import { default as CSRF } from "csrf";
const csrf = new CSRF();
const corsOption: cors.CorsOptions = {
  origin: "http://localhost:5173",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "xsrf-token"],
  
};
const app = express();
app.use(express.json());
app.use(cors(corsOption));
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../../public/uploads")),
);
app.use("/mail", express.static(path.join(__dirname, "../../public/mail")));
app.get(
  "/api/v1",
  expressAsyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        res.status(201).json({
          status: "Success",
          message: "thanks to use fullcoding api !",
        });
      } catch (error) {
        next(error);
      }
    },
  ),
);

app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  console.log("CSRF ERROR", _req.cookies["xsrf-token"]);
  if (err.code === "EBADCSRFTOKEN") {
    res.status(403).json({
      status: "Error",
      message: "Invalid CSRF token",
    });
    return;
  }

  console.error(err);
  res.status(500).json({ status: "Error", message: "Internal Server Error" });
});

app.use(csrfProtection);

app.get("/api/v1/csrf-token", (req: Request, res: Response) => {
  const newSecret = csrf.secretSync();
  const csrfToken = csrf.create(newSecret);
  res.cookie("csrf-secret", newSecret, {
    httpOnly: true,
  });
  res.json({ csrfToken });
});
//load routes
app.use("/api/v1", authRoutes);

app.use("/api/v1", personnal_info_routes);

app.use("/api/v1", otpRoutes);

app.use("/api/v1", boutiksRoutes);

app.use("/api/v1", productRoutes);

export default app;
