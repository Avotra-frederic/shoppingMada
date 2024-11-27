import multer from "multer";
import path from "path";
const storage = multer.diskStorage({
    destination: path.join(__dirname,"../../public/uploads/"),
    filename: (req,file, cb) =>{
        cb(null,`${Date.now()}-${file.originalname}`);
    }
})

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png/;
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
}).single("image");

export default upload;
