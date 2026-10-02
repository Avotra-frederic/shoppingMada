import { FilterQuery } from "mongoose";
import User from "../model/user.model";
import IUser, { LeanUser } from "../interface/user.interface";
import crypto from "crypto";
/**
 *
 * @interface credentials
 */
interface credentials {
  emailOrPhone: string;
  password: string;
}

/**
 *
 *
 * @param {credentials} credentials
 * @return {*}  {(Promise<LeanUser | null>)}
 */
const getUserWithCredentials = async (
  credentials: credentials,
): Promise<LeanUser | null> => {
  const { password } = credentials;
  const emailOrPhone = credentials.emailOrPhone.trim().toLowerCase();
  const filter: FilterQuery<IUser> = {
    $or: [{ email: emailOrPhone }, { phonenumber: emailOrPhone }],
  };
  try {
    const user: LeanUser | null = await User.findOne(filter)
      .lean<LeanUser>()
      .populate({path:"boutiks_id",populate:{path:"subscription_id"}})
      .populate("personnalInfo_id")
      .populate({
        path: "userGroupMember_id",
        populate: { path: "usergroup_id" },
      });
    
    return user ? user : null;
  } catch (error) {
    throw error;
  }
};

/**
 * @param {IUser} credentials
 * @return {*}  {Promise<IUser>}
 */
const createUser = async (credentials: IUser): Promise<IUser> => {
  try {
    const user = await User.create(credentials);
    return user;
  } catch (error) {
    throw error;
  }
};

/**
 * @param {IUser} credentials
 * @return {*}  {(Promise <IUser | null>)}
 */
const checkExistingUser = async (credentials: IUser): Promise<IUser | null> => {
  const { email, phonenumber } = credentials;
  const filter: FilterQuery<IUser> = { $or: [{ email }, { phonenumber }] };
  try {
    const user = await User.findOne(filter)
    .lean<LeanUser>()
    .populate({path:"boutiks_id",populate:{path:"subscription_id"}})
    .populate("personnalInfo_id")
    .populate({
      path: "userGroupMember_id",
      populate: { path: "usergroup_id" },
    });
    return user ? user : null;
  } catch (error) {
    throw error;
  }
};
/**
 *
 * @param id
 * @returns
 */
const createEmailOtp = async (id: string): Promise<string> => {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const hash = crypto.createHash("sha256").update(`${id}:${code}`).digest("hex");
  await User.findByIdAndUpdate(id, {
    emailOtpHash: hash,
    emailOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    emailOtpAttempts: 0,
  });
  return code;
};

const verifyEmailOtp = async (id: string, code: string): Promise<IUser | null> => {
  const user = await User.findById(id).select("+emailOtpHash +emailOtpExpiresAt +emailOtpAttempts");
  if (!user?.emailOtpHash || !user.emailOtpExpiresAt || user.emailOtpExpiresAt.getTime() <= Date.now() || (user.emailOtpAttempts ?? 0) >= 5) return null;
  const hash = crypto.createHash("sha256").update(`${id}:${code}`).digest("hex");
  const actual = Buffer.from(user.emailOtpHash, "hex");
  const expected = Buffer.from(hash, "hex");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    await User.updateOne({ _id: id, emailOtpHash: user.emailOtpHash, emailOtpAttempts: { $lt: 5 } }, { $inc: { emailOtpAttempts: 1 } });
    return null;
  }
  return User.findOneAndUpdate({
    _id: id,
    emailOtpHash: hash,
    emailOtpExpiresAt: { $gt: new Date() },
    emailOtpAttempts: { $lt: 5 },
  }, {
    emailVerifyAt: new Date(),
    $unset: { emailOtpHash: 1, emailOtpExpiresAt: 1, emailOtpAttempts: 1 },
  }, { new: true });
};

const deleteUser = async (id: string): Promise<IUser | null> => {
  try {
    const user = await User.findByIdAndDelete(id, { new: true });
    return user ? user : null;
  } catch (error) {
    throw error;
  }
};

const updateUser = async (
  id: string,
  newInfo: IUser,
): Promise<IUser | null> => {
  try {
    const user = await User.findByIdAndUpdate(id, newInfo, { new: true });
    return user ? user : null;
  } catch (error) {
    throw error;
  }
};

const getUser = async (id: string): Promise<IUser | null> => {
  try {
    const user = await User.findById(id)
      .lean<IUser>()
      .populate({path:"boutiks_id",populate:{path:"subscription_id"}})
      .populate("personnalInfo_id")
      .populate({
        path: "userGroupMember_id",
        populate: { path: "usergroup_id" },
      });
    return user ? user : null;
  } catch (error) {
    throw error;
  }
};

const getAllUser = async (): Promise<IUser[] | null> => {
  try {
    const user = await User.find({})
      .lean<IUser[]>()
      .populate({path:"boutiks_id",populate:{path:"subscription_id"}})
      .populate("personnalInfo_id")
      .populate({
        path: "userGroupMember_id",
        populate: { path: "usergroup_id" },
      });
    return user ? user : null;
  } catch (error) {
    throw error;
  }
};

export {
  getAllUser,
  getUserWithCredentials,
  createUser,
  checkExistingUser,
  createEmailOtp,
  verifyEmailOtp,
  deleteUser,
  updateUser,
  getUser,
};
