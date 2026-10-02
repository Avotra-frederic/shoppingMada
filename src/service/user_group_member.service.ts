import { Types } from "mongoose";
import IUserGroupMember, {
  LeanUserGroupMember,
} from "../interface/user_group_member.interface";
import UserGroupMember from "../model/userGroupMember.model";

const add_user_in_user_group = async (
  data: IUserGroupMember,
): Promise<IUserGroupMember | null> => {
  if (data == null) return null;
  return UserGroupMember.findOneAndUpdate(
    { user_id: data.user_id },
    { $set: { usergroup_id: data.usergroup_id } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
};

const get_user_group_name = async ({
  user_id,
}: {
  user_id: Types.ObjectId;
}): Promise<string | null> => {
  const userGroupName = await UserGroupMember.findOne({ user_id })
    .populate("usergroup_id")
    .select("name")
    .exec();
  if (userGroupName) {
    const { name }: { name: string } = userGroupName.usergroup_id;
    return name;
  }
  return null;
};

const change_user_group = async ({
  user_id,
  newusergroup_id,
}: {
  user_id: Types.ObjectId;
  newusergroup_id: Types.ObjectId;
}): Promise<LeanUserGroupMember | null> => {
  const userGroupMember = await UserGroupMember.findOne({ user_id }).exec();
  if (!userGroupMember) return null;
  userGroupMember.usergroup_id = newusergroup_id;
  await userGroupMember.save();
  return userGroupMember;
};

const delete_user_in_user_group = async ({
  user_id,
}: {
  user_id: Types.ObjectId;
}): Promise<LeanUserGroupMember | null> => {
  const userGroupMember = await UserGroupMember.findOneAndDelete({
    user_id,
  }).exec();
  if (!userGroupMember) return null;
  return userGroupMember;
};

export { add_user_in_user_group, get_user_group_name, change_user_group, delete_user_in_user_group };
