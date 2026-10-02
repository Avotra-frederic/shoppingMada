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
    limits: { files: 10, fileSize: 5 * 1024 * 1024 },
}).array("image",10);

const uploadProductImages = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowed = /\.(jpeg|jpg|png|webp)$/i.test(path.extname(file.originalname)) && /^image\/(jpeg|png|webp)$/.test(file.mimetype);
        if (allowed) cb(null, true);
        else cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    },
    limits: { files: 5, fileSize: 5 * 1024 * 1024 },
}).array("image", 5);

export {uploadImage, uploadProductImages};
export default upload;
