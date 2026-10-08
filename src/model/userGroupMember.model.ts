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
    ,adminPermissions: { type: [String], enum: ["support.read", "support.reply", "support.manage", "moderation.review", "finance.read", "finance.refund", "finance.payout"], default: [] }
})

const UserGroupMember = models.UserGroupMember || model("UserGroupMember", userGroupMemberSheme);
export default UserGroupMember;
