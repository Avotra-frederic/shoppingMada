import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import IPersonalInfo from "../interface/personnal_info.interface";
import { completPersonnalInfo, create_personnal_info, get_personnal_info_by_owner_id, listKycSubmissions, reviewKycSubmission } from "../service/personnel_info.service";
import { getUser, updateUser } from "../service/user.service";
import { ObjectId, Schema, Types } from "mongoose";
import IUser from "../interface/user.interface";
import AdminAudit from "../model/admin-audit.model";
import { get_user_group_name } from "../service/user_group_member.service";
import PersonnalInfo from "../model/personnalInfo";
import { createReadStream, existsSync } from "fs";
import path from "path";
import { kycDocumentDirectory } from "../config/uploadsingle_multer";
import sendEmail from "../helpers/mail";

const store_personnal_info= expressAsyncHandler(async(req: Request, res: Response, next: NextFunction)=>{
   
    try {
        const data: IPersonalInfo = req.body;
        Object.assign(data, {owner_id: (req as any).user._id});
        const personnalInfo = await create_personnal_info(data);
        if(!personnalInfo){
            res.status(401).json({status: "Failed", message:"Impossible d’enregistrer vos informations personnelles."});
            return;
        }
        const newUser = await updateUser(String((req as any).user._id),{personnalInfo_id: new Types.ObjectId(String(personnalInfo._id))} as IUser);
        if(!newUser)
        {
            res.status(400).json({message:"Impossible de mettre à jour le compte. Veuillez réessayer."});
            return
        }
        const updatedUser = await getUser(String(newUser._id));
        if (!updatedUser) {
            res.status(500).json({status: "Failed", message: "Le profil a été enregistré, mais son actualisation a échoué."});
            return;
        }

        const { password: _password, ...userInfo } = updatedUser;
        res.status(201).json({status:"Success", message:"Vos informations personnelles ont été enregistrées.", userInfo});
    } catch (error) {
        next(error);
    }
});


const getPersonalInfo = expressAsyncHandler(async(req: Request, res:Response)=>{
    const personnalInfo = await get_personnal_info_by_owner_id((req as any).user._id);
    if(!personnalInfo){
        res.status(201).json({status:"Success", data: null});
        return;
    };
    res.status(201).json({status:"Success", data: personnalInfo});
});

const updatePersonnalInfo = expressAsyncHandler(async(req: Request, res:Response)=>{
    const data = req.body;
    const fileNames = (req as any).fileNames ?? [];
    const cin = String(data.cin ?? "").trim();
    if (!cin || cin.length > 40 || fileNames.length !== 2) {
        res.status(400).json({ status: "Failed", message: "Le numéro CIN et les photos du recto et du verso sont obligatoires." });
        return;
    }
    const [frontImage, backImage] = fileNames;
    const newData = { cin, frontImage, backImage };
    const updatePersonnalInfo = await completPersonnalInfo((req as any).user._id, newData);
    if(!updatePersonnalInfo){
        res.status(500).json({status:"Failed", message:"Impossible d’enregistrer la vérification du compte."});
        return;
    };

    res.status(200).json({status:"Success", message:"Vos informations de vérification ont été enregistrées.", data: updatePersonnalInfo});
})

const listKycForAdmin = expressAsyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const role = await get_user_group_name({ user_id: new Types.ObjectId(String(user._id)) });
    if (role !== "Super Admin") {
        res.status(403).json({ status: "Failed", message: "Accès réservé au Super Admin." });
        return;
    }
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    if (status && !["pending", "approved", "rejected"].includes(status)) {
        res.status(400).json({ status: "Failed", message: "Filtre KYC invalide." });
        return;
    }
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "25"), 10) || 25));
    const result = await listKycSubmissions(status, page, limit);
    res.status(200).json({ status: "Success", ...result });
});

const decideKyc = expressAsyncHandler(async (req: Request, res: Response) => {
    const actor = (req as any).user;
    const role = await get_user_group_name({ user_id: new Types.ObjectId(String(actor._id)) });
    if (role !== "Super Admin") {
        res.status(403).json({ status: "Failed", message: "Accès réservé au Super Admin." });
        return;
    }
    const status = req.body.status;
    const reason = typeof req.body.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";
    if (!["approved", "rejected"].includes(status) || (status === "rejected" && reason.length < 3)) {
        res.status(400).json({ status: "Failed", message: "Décision invalide. Un motif est requis pour un refus." });
        return;
    }
    const previous: any = await PersonnalInfo.findById(req.params.id).lean();
    if (!previous || !previous.cin || !previous.frontImage || !previous.backImage) {
        res.status(404).json({ status: "Failed", message: "Dossier KYC introuvable ou incomplet." });
        return;
    }
    const result: any = await reviewKycSubmission(req.params.id, String(actor._id), status, reason);
    if (!result) {
        res.status(404).json({ status: "Failed", message: "Dossier KYC introuvable." });
        return;
    }
    await AdminAudit.create({ actorId: actor._id, actorName: actor.username, action: `kyc.${status}`, targetType: "kyc", targetId: String(result._id), targetLabel: String(result.cin ?? "Dossier KYC"), reason, ip: req.ip });
    const ownerEmail = (result.owner_id as any)?.email;
    if (ownerEmail) {
        try {
            await sendEmail({
                title: status === "approved" ? "Vérification d’identité approuvée" : "Vérification d’identité à corriger",
                message: status === "approved" ? "Vos documents ont été vérifiés." : "Votre dossier nécessite une correction.",
                information: reason ? `Motif : ${reason}` : "",
                content: "Connectez-vous à votre espace vendeur pour consulter votre compte.",
            }, ownerEmail, status === "approved" ? "Vérification approuvée" : "Vérification à corriger");
        } catch (error) { console.error("KYC decision email failed", error); }
    }
    res.status(200).json({ status: "Success", message: status === "approved" ? "Dossier KYC approuvé." : "Dossier KYC refusé.", data: result });
});

const getKycDocument = expressAsyncHandler(async (req: Request, res: Response) => {
    const actor = (req as any).user;
    if (await get_user_group_name({ user_id: new Types.ObjectId(String(actor._id)) }) !== "Super Admin") {
        res.status(403).json({ status: "Failed", message: "Accès réservé au Super Admin." }); return;
    }
    const record: any = await PersonnalInfo.findById(req.params.id).select("frontImage backImage").lean();
    const filename = req.params.side === "front" ? record?.frontImage : req.params.side === "back" ? record?.backImage : undefined;
    if (!filename || path.basename(filename) !== filename || !/^[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i.test(filename)) {
        res.status(404).json({ status: "Failed", message: "Document introuvable." }); return;
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.type(path.extname(filename));
    const privatePath = path.join(kycDocumentDirectory, filename);
    const legacyPublicPath = path.join(__dirname, "../public/uploads", filename);
    const documentPath = existsSync(privatePath) ? privatePath : legacyPublicPath;
    createReadStream(documentPath).on("error", () => {
        if (!res.headersSent) res.status(404).json({ status: "Failed", message: "Document introuvable." });
    }).pipe(res);
});
export {store_personnal_info, getPersonalInfo, updatePersonnalInfo, listKycForAdmin, decideKyc, getKycDocument};
