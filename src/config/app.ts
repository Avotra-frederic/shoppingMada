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
app.use(cors(corsOption));
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
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
          message: "Merci d’utiliser l’API ShopInMada.",
        });
      } catch (error) {
        next(error);
      }
    },
  ),
);

;

app.use(csrfProtection);

app.get("/api/v1/csrf-token", expressAsyncHandler(async(req: Request, res: Response) => {
  let secret = req.cookies["csrf-secret"];
  if(!secret){
    secret = csrf.secretSync();
    res.cookie("csrf-secret", secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000,
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
app.use((req: Request, res: Response) => {
  res.status(404).json({ status: "Error", message: `Route introuvable: ${req.method} ${req.path}` });
});
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err.code === "EBADCSRFTOKEN") {
    res.status(403).json({ status: "Error", message: "Jeton de sécurité invalide ou expiré." });
    return;
  }
  if (err.type === "entity.too.large") {
    res.status(413).json({ status: "Error", message: "La requête dépasse la taille maximale autorisée." });
    return;
  }
  const status = err.statusCode || err.status || 500;
  res.status(status).json({ status: "Error", message: status < 500 ? err.message : "Une erreur interne est survenue." });
});

export default app;
