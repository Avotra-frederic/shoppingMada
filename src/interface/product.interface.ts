import { Document, Types } from "mongoose";

export default interface IProduct extends Document{
    _id: Types.ObjectId | string,
    name: string,
    description: string,
    details: string,
    category: string,
    price: number,
    stock?: number,
    photos:[string],
    variant? : [{name: string,  additionalPrice: number, color?: string}]
}
