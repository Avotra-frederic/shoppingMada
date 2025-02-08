import { model, models, Schema } from "mongoose";
import IComment from "../interface/comment.interface";

const commentScheme = new Schema({
    comment:{
        type: String,
        required: true
    },
    owner_id:{
        type:Schema.Types.ObjectId,
        ref: "User",
        require:true
    },
    product_id:{
        type:Schema.Types.ObjectId,
        ref: "Product",
        require:true
    },
    date:{
        type:Date,
        default: new Date()
    }
},{timestamps: true})

const Comment = models.Comment || model<IComment>("Comment", commentScheme);
export default Comment;
