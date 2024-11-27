import { Document, Types } from "mongoose";

export default interface IUserGroup extends Document
{
    name: string;
}
export type LeanUserGroup = Omit<IUserGroup, '_id'> & { _id: Types.ObjectId };
