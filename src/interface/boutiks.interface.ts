import { Document, Types } from "mongoose";

export default interface IBoutiks extends Document
{
    _id: Types.ObjectId;
    name:string,
    phoneNumber: string,
    email: string,
    owner_id: Types.ObjectId | string,
    logo: string,
    product_category?: [Types.ObjectId | string];
}
