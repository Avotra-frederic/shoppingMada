import IComment from "../interface/comment.interface";
import Comment from "../model/comment.model";

type NewComment = Pick<IComment, "comment" | "owner_id" | "product_id"> &
    Partial<Pick<IComment, "moderationStatus" | "moderationReason">>;

const addComment = async(data: NewComment) : Promise<IComment | null> =>{
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

const findComment = async (id: string): Promise<IComment | null> =>
    Comment.findById(id).lean<IComment>();

const getCommentsForModeration = async (page = 1, limit = 25): Promise<IComment[]> =>
    Comment.find({})
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit).limit(limit)
        .lean<IComment[]>()
        .populate("owner_id", "username email")
        .populate("product_id", "name boutiks_id");

const moderateComment = async (
    id: string,
    moderationStatus: "Approved" | "Rejected",
    moderationReason: string,
    moderatorId: string,
): Promise<IComment | null> =>
    Comment.findByIdAndUpdate(id, {
        moderationStatus,
        moderationReason,
        moderatedBy: moderatorId,
        moderatedAt: new Date(),
    }, { new: true, runValidators: true }).lean<IComment>();

const getProductComment = async(product_id: string): Promise<IComment[] | null> =>{
    try {
        const comment  = await Comment.find({product_id: product_id, moderationStatus: "Approved"}).lean<IComment[]>().populate("owner_id");
        return comment ? comment : null
    } catch (error) {
        throw error
    }
}

export {addComment, deleteComment, getProductComment, findComment, getCommentsForModeration, moderateComment}
