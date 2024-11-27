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
const app = express();
app.use(express.json());
app.use(cors())
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
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ status: "Error", message: "Internal Server Error" });
});

//load routes
app.use("/api/v1",authRoutes);

app.use("/api/v1",personnal_info_routes);

app.use("/api/v1",otpRoutes);

app.use("/api/v1", boutiksRoutes);

export default app;
