import { FilterQuery } from "mongoose";
import User from "../model/user.model";
import IUser, { LeanUser } from "../interface/user.interface";
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
  const { emailOrPhone, password } = credentials;
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
const verifyEmailUser = async (id: string): Promise<IUser | null> => {
  try {
    const user = await User.findByIdAndUpdate(id, {
      emailVerifyAt: Date.now(),
    }).exec();
    return user ? user : null;
  } catch (error) {
    throw error;
  }
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
  verifyEmailUser,
  deleteUser,
  updateUser,
  getUser,
};
