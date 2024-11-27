import { Document, Types } from "mongoose";

export default interface IPersonalInfo extends Document
{
    firstName: string;
    lastName: string;
    adresse:string;
    gender:string;
    cin?:string;
    owner_id?: Types.ObjectId | string;
}

export type LeanPersonnalInfo = Omit<IPersonalInfo, "_id"> & {_id:Types.ObjectId};
