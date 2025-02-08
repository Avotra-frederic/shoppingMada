import { Types } from "mongoose";
import { Document } from "mongoose";

export default interface IUser extends Document
{
    username: string,
    email:string,
    phonenumber:string,
    emailVerifyAt?:string,
    password: string,
    photos?: string,
    boutiks_id? : Types.ObjectId | string,
    personnalInfo_id : Types.ObjectId
    userGroupMember_id:Types.ObjectId
}
export type LeanUser = Omit<IUser, '_id'> & { _id: Types.ObjectId };
