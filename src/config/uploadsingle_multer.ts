import multer from "multer";
import path from "path";
import { mkdirSync } from "fs";
import { randomUUID } from "crypto";
const uploadDirectory = path.join(__dirname,"../../public/uploads/");
mkdirSync(uploadDirectory, { recursive: true });
const storage = multer.diskStorage({
    destination: uploadDirectory,
    filename: (req,file, cb) =>{
        cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
    }
})

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const extname = /\.(jpeg|jpg|png|webp)$/i.test(path.extname(file.originalname));
        const mimetype = /^image\/(jpeg|png|webp)$/.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    },
    limits: { files: 1, fileSize: 5 * 1024 * 1024 },
}).single("image");

const uploadImage = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const valid = /\.(jpeg|jpg|png|webp)$/i.test(path.extname(file.originalname)) && /^image\/(jpeg|png|webp)$/.test(file.mimetype);
        if (valid) cb(null, true);
        else cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    },
    limits: { files: 2, fileSize: 5 * 1024 * 1024 },
}).array("image",2);

const uploadProductImages = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowed = /\.(jpeg|jpg|png|webp)$/i.test(path.extname(file.originalname)) && /^image\/(jpeg|png|webp)$/.test(file.mimetype);
        if (allowed) cb(null, true);
        else cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    },
    limits: { files: 5, fileSize: 5 * 1024 * 1024 },
}).array("image", 5);

export const paymentEvidenceDirectory = path.join(__dirname, "../../private/payment-evidence");
mkdirSync(paymentEvidenceDirectory, { recursive: true });
const paymentEvidenceStorage = multer.diskStorage({
    destination: paymentEvidenceDirectory,
    filename: (_req, file, cb) => {
        cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
    },
});
const uploadPaymentEvidence = multer({
    storage: paymentEvidenceStorage,
    fileFilter: (req, file, cb) => {
        const allowed = /\.(jpeg|jpg|png|webp)$/i.test(path.extname(file.originalname)) && /^image\/(jpeg|png|webp)$/.test(file.mimetype);
        if (allowed) cb(null, true);
        else cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    },
    limits: { files: 1, fileSize: 5 * 1024 * 1024 },
}).single("evidence");

export {uploadImage, uploadProductImages};
export { uploadPaymentEvidence };
export default upload;
