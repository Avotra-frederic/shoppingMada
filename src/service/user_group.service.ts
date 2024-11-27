import { Types } from "mongoose";
import IUserGroup from "../interface/user_group.interface";
import UserGroup from "../model/userGroup.model";
type UserGroupId = {
    _id: Types.ObjectId
}
const findUserGroupId = async( name : string ): Promise<UserGroupId | null>  =>{
    const userGroup = await UserGroup.findOne({ name }).select("_id").lean();
    if(!userGroup) return null;
    return userGroup as UserGroupId;
}

const createUserGroup = async(usegroup : IUserGroup): Promise<IUserGroup | null> =>{
    const usergroup: IUserGroup =  new UserGroup(usegroup);
    await usergroup.save();
    if (usergroup) return usergroup;
    return null;
}

export {findUserGroupId, createUserGroup}
