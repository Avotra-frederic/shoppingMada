import { Types } from "mongoose";

export default interface IUserGroupMember extends Document
{
    usergroup_id: Types.ObjectId,
    user_id: Types.ObjectId,
}
export type LeanUserGroupMember = Omit<IUserGroupMember, "_id"> & {_id:Types.ObjectId}
