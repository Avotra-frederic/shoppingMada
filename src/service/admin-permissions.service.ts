export const hasAdminPermission = (user: any, permission: string) =>
  user?.userGroupMember_id?.usergroup_id?.name === "Super Admin" ||
  (Array.isArray(user?.adminPermissions) && user.adminPermissions.includes(permission));
