import { Document, Types } from "mongoose";

export default interface IComment extends Document
{
    _id: Types.ObjectId,
    comment: string,
    owner_id: Types.ObjectId | string,
    product_id: Types.ObjectId | string,
    moderationStatus?: "Pending" | "Approved" | "Rejected",
    moderationReason?: string,
    moderatedBy?: Types.ObjectId | string,
    moderatedAt?: Date
}