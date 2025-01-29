import { Document, Schema } from "mongoose"

export default interface ICommand extends Document {
    product_id:Schema.Types.ObjectId | string;
    quantity: number;
    owner_id:Schema.Types.ObjectId | string;
    status: string;
    boutiks_id:Schema.Types.ObjectId | string;
    variants:{[key : string]: string} | unknown;
    total: number
}