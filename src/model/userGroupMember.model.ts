import { model, models, Schema } from "mongoose";
import IUserGroupMember from "../interface/user_group_member.interface";

const userGroupMemberSheme = new Schema<IUserGroupMember>({
    usergroup_id :{
        type : Schema.Types.ObjectId,
        ref : "UserGroup"
    },
    user_id :{
        type : Schema.Types.ObjectId,
        ref: "User"
    }
})

const UserGroupMember = models.UserGroupMember || model("UserGroupMember", userGroupMemberSheme);
export default UserGroupMember;
