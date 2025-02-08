import { Types } from "mongoose";

export default interface IUserGroupMember extends Document
{
    _id:Types.ObjectId
    usergroup_id: Types.ObjectId,
    user_id: Types.ObjectId,
}
export type LeanUserGroupMember = Omit<IUserGroupMember, "_id"> & {_id:Types.ObjectId}
