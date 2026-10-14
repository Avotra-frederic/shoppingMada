import IUser from "../interface/user.interface";

type TokenUser = Partial<IUser> & Record<string, any>;

const referenceId = (value: any): string | undefined => {
  if (!value) return undefined;
  const id = typeof value === "object" ? value._id : value;
  return id == null ? undefined : String(id);
};

/** Keep cookie JWTs small; full profile data belongs in the JSON API response. */
const toAuthTokenPayload = (user: TokenUser): Record<string, unknown> => {
  const membership = user.userGroupMember_id as any;
  const group = membership?.usergroup_id;
  return {
    _id: referenceId(user._id),
    username: user.username,
    email: user.email,
    phonenumber: user.phonenumber,
    boutiks_id: referenceId(user.boutiks_id),
    userGroupMember_id: membership
      ? {
          usergroup_id: { name: typeof group === "object" ? group?.name : undefined },
          adminPermissions: Array.isArray(membership.adminPermissions) ? membership.adminPermissions : [],
        }
      : undefined,
  };
};

export default toAuthTokenPayload;
