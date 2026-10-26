import multer from "multer";
import path from "path";
import { mkdirSync } from "fs";
import { randomUUID } from "crypto";
import sharp from "sharp";
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
    fileFilter: (_req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();
        const knownImageExtension = /\.(jpe?g|png|webp|avif|gif|tiff?|heic|heif|svg)$/i.test(extension);
        const imageMime = file.mimetype.toLowerCase().startsWith("image/");
        const genericMimeWithImageExtension = ["application/octet-stream", "binary/octet-stream", ""].includes(file.mimetype.toLowerCase()) && knownImageExtension;
        if (imageMime || genericMimeWithImageExtension) cb(null, true);
        else cb(Object.assign(new Error("Choisissez un fichier image."), { statusCode: 415 }));
    },
    limits: { files: 5, fileSize: 20 * 1024 * 1024 },
}).array("image", 5);

export async function normalizeProductImages(files: Express.Multer.File[]) {
    const normalized: Express.Multer.File[] = [];
    try {
        for (const file of files) {
            const webp = await sharp(file.path, { limitInputPixels: 60_000_000, animated: false })
                .rotate()
                .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
                .webp({ quality: 82, effort: 4 })
                .toBuffer();
            if (webp.length > 8 * 1024 * 1024) {
                throw Object.assign(new Error("Une image reste trop volumineuse après optimisation. Choisissez une image de résolution plus faible."), { statusCode: 413 });
            }
            const filename = `${randomUUID()}.webp`;
            const outputPath = path.join(uploadDirectory, filename);
            const { writeFile, unlink } = await import("fs/promises");
            await writeFile(outputPath, webp, { flag: "wx" });
            await unlink(file.path);
            file.filename = filename;
            file.path = outputPath;
            file.mimetype = "image/webp";
            file.size = webp.length;
            file.destination = uploadDirectory;
            normalized.push(file);
        }
        return normalized;
    } catch (error) {
        const { unlink } = await import("fs/promises");
        await Promise.all(files.map((file) => unlink(file.path).catch(() => undefined)));
        if ((error as { statusCode?: number }).statusCode) throw error;
        throw Object.assign(new Error("Format d’image non pris en charge ou fichier illisible. Formats pris en charge : JPEG, PNG, WebP, AVIF, HEIC/HEIF, GIF, TIFF et SVG."), { statusCode: 415 });
    }
}

export const paymentEvidenceDirectory = path.join(__dirname, "../../private/payment-evidence");
mkdirSync(paymentEvidenceDirectory, { recursive: true });
const uploadKycImages = multer({
    // Reuse the existing persistent uploads volume; the app blocks public
    // access to filenames referenced as KYC documents.
    storage,
    fileFilter: (_req, file, cb) => {
        const allowed = /\.(jpeg|jpg|png|webp)$/i.test(path.extname(file.originalname)) && /^image\/(jpeg|png|webp)$/.test(file.mimetype);
        if (allowed) cb(null, true); else cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    },
    limits: { files: 2, fileSize: 5 * 1024 * 1024 },
}).array("image", 2);
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

export {uploadImage, uploadProductImages, uploadKycImages};
export const kycDocumentDirectory = uploadDirectory;
export { uploadPaymentEvidence };
export default upload;
