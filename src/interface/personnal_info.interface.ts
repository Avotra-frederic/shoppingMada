import { Document, Types } from "mongoose";

export default interface IPersonalInfo extends Document
{
    firstName: string;
    lastName: string;
    adresse:string;
    gender:string;
    phoneNumber:String;
    cin?:string;
    owner_id?: Types.ObjectId | string;
    frontImage?: string;
    backImage?: string;
}

export type LeanPersonnalInfo = Omit<IPersonalInfo, "_id"> & {_id:Types.ObjectId};
