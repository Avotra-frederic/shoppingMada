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
import commentRoutes from "../routers/comment.routes";
import command_routes from "../routers/command.routes";
import userRouter from "../routers/user.routes";
import subscriptionRoute from "../routers/subscription.routes";
const csrf = new CSRF();
const corsOption: cors.CorsOptions = {
  origin: process.env.ALLOWED_ORIGIN as string,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "xsrf-token","Origin"],
  preflightContinue: false,
  
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

app.use("/api/v1/uploads", (req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN as string);
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(
  "/api/v1/uploads",
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

;

app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  console.log("CSRF ERROR", _req.cookies["xsrf-token"]);
  if (err.code === "EBADCSRFTOKEN") {
    res.status(403).json({
      status: "Error",
      message: "Invalid CSRF token",
    });
    return;
  }
  res.status(500).json({ status: "Error", message: "Internal Server Error" });
});

app.use(csrfProtection);

app.get("/api/v1/csrf-token", expressAsyncHandler(async(req: Request, res: Response) => {
  let secret = req.cookies["csrf-secret"];
  if(!secret){
    secret = csrf.secretSync();
    res.cookie("csrf-secret", secret, {
      httpOnly: true,
    });
  }
  
  const csrfToken = csrf.create(secret);
  res.json({ csrfToken });
}));
//load routes
app.use("/api/v1", authRoutes);
app.use("/api/v1", userRouter);

app.use("/api/v1", personnal_info_routes);

app.use("/api/v1", otpRoutes);

app.use("/api/v1", boutiksRoutes);

app.use("/api/v1", productRoutes);

app.use("/api/v1", commentRoutes);

app.use("/api/v1", command_routes);
app.use("/api/v1", subscriptionRoute);

export default app;
