import IComment from "../interface/comment.interface";
import Comment from "../model/comment.model";

const addComment = async(data: IComment) : Promise<IComment | null> =>{
    try {
        const comment = await Comment.create(data);
        return comment ? comment : null;
    } catch (error) {
        throw error;
    }
}

const deleteComment = async(id: string): Promise<IComment | null> =>{
    try {
        const comment= await Comment.findByIdAndDelete(id, {new: true}).lean<IComment>().populate("owner_id").populate("product_id");
        return comment ? comment : null;
    } catch (error) {
        throw error;
    }
}

const getProductComment = async(product_id: string): Promise<IComment | null> =>{
    try {
        const comment  = await Comment.find({product_id: product_id}).lean<IComment>().populate("owner_id");
        return comment ? comment : null
    } catch (error) {
        throw error
    }
}

export {addComment, deleteComment, getProductComment}