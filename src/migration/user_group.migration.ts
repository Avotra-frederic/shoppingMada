import UserGroup from "../model/userGroup.model"
import UserGroupMember from "../model/userGroupMember.model";
import User from "../model/user.model";

const user_group_migration = async()=>{
    const data = ["Super Admin", "Admin", "Boutiks", "Client", "Support", "Moderator", "Finance", "Read Only"];
    for (const name of data) {
        await UserGroup.updateOne({ name }, { $setOnInsert: { name } }, { upsert: true });
    }

    // Keep a single Super Admin during upgrades of installations where the old
    // account screen may have promoted several users to that group.
    const superAdminGroup = await UserGroup.findOne({ name: "Super Admin" }).select("_id").lean<any>();
    if (!superAdminGroup) return;
    const memberships = await UserGroupMember.find({ usergroup_id: superAdminGroup._id }).select("_id user_id").lean<any[]>();
    if (memberships.length <= 1) return;
    const userIds = memberships.map((membership) => membership.user_id).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } }).select("_id createdAt").sort({ createdAt: 1, _id: 1 }).lean<any[]>();
    const primaryId = users[0]?._id ?? memberships[0].user_id;
    const adminGroup = await UserGroup.findOne({ name: "Admin" }).select("_id").lean<any>();
    const extras = memberships.filter((membership) => String(membership.user_id) !== String(primaryId));
    if (extras.length) {
        await UserGroupMember.updateMany({ _id: { $in: extras.map((membership) => membership._id) } }, { $set: { usergroup_id: adminGroup?._id, adminPermissions: [] } });
        console.warn(`Réconciliation des rôles: ${extras.length} ancien(s) Super Admin rétrogradé(s) en Admin sans permission. Le compte Super Admin le plus ancien est conservé.`);
    }
}

export default user_group_migration;
