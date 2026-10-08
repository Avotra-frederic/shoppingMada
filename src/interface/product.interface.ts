import { Document, Types } from "mongoose";

export default interface IProduct extends Document{
    _id: Types.ObjectId,
    name: string,
    description: string,
    details: string,
    category: string,
    price: number,
    stock?: number,
    photos:[string],
    variant?: Array<{
        name: string;
        additionalPrice?: number;
        values?: Array<{ value: string; additionalPrice?: number; stock?: number }>;
    }>;
    owner_id: any,
    boutiks_id: any,
    metadata?:any,
    publicationStatus?: "Pending" | "Approved" | "Rejected",
    moderationReason?: string,
    moderatedBy?: Types.ObjectId | string,
    moderatedAt?: Date
    wishlistedBy?: Types.ObjectId[]
}
