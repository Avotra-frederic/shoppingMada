import { Document, Types } from "mongoose";

export default interface IComment extends Document
{
    _id: string | Types.ObjectId,
    comment: string,
    owner_id: Types.ObjectId | string,
    product_id: Types.ObjectId | string
}