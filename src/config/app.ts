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
import csurf from "csurf";
const corsOption: cors.CorsOptions = {
    origin: "http://localhost:5173",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    allowedHeaders: ["Content-Type, Authorization","xsrf-token"]
}
const app = express();
app.use(express.json());
app.use(cors(corsOption));
app.use(express.urlencoded({extended: true}));
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '../../public/uploads')));
app.use('/mail', express.static(path.join(__dirname, '../../public/mail')));
app.get("/api/v1",expressAsyncHandler(async ( req: Request, res: Response, next: NextFunction)=>{
    try {
        res.status(201).json({status: "Success", message: "thanks to use fullcoding api !"})
    } catch (error) {
        next(error);
    }
}))

export const csrfProtection = csurf({
    cookie: {
        httpOnly:true,
        secure: process.env.NODE_ENV === "production",
        
        
    }
});


app.use((err: any, _req: Request, res: Response, next:NextFunction) => {
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

app.get("/api/v1/csrf-token", csrfProtection,  (req: Request, res: Response) => {
    res.json({ csrfToken: req.csrfToken() });
})
//load routes
app.use("/api/v1",csrfProtection,authRoutes);

app.use("/api/v1",csrfProtection,personnal_info_routes);

app.use("/api/v1",csrfProtection,otpRoutes);

app.use("/api/v1",csrfProtection, boutiksRoutes);

app.use("/api/v1",csrfProtection, productRoutes);

export default app;
