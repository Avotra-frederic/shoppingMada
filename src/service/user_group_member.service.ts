import { Types } from "mongoose";
import IUserGroupMember, { LeanUserGroupMember } from "../interface/user_group_member.interface";
import UserGroupMember from "../model/userGroupMember.model";

const add_user_in_user_group = async (data: IUserGroupMember): Promise<IUserGroupMember | null> =>{
    if (data == null) return null;
    const newUserGroupMember = new UserGroupMember(data);
    await newUserGroupMember.save();
    if(!newUserGroupMember) return null;
    return newUserGroupMember;
}

const get_user_group_name = async({user_id}:{user_id: Types.ObjectId}): Promise<string| null > =>{
    const userGroupName = await UserGroupMember.findOne({user_id}).populate("usergroup_id").select("name").exec()
    if(userGroupName){
        const {name}: {name: string} = userGroupName.usergroup_id;
        return name;
    }
    return null;
}

export {add_user_in_user_group, get_user_group_name};
