import { FilterQuery, Types } from "mongoose";
import IPersonalInfo, {
    LeanPersonnalInfo,
} from "../interface/personnal_info.interface";
import PersonnalInfo from "../model/personnalInfo";


/**
 *
 *
 * @param {IPersonalInfo} data
 * @return {*}  {(Promise<IPersonalInfo | null>)}
 */
const create_personnal_info = async (
  data: IPersonalInfo
): Promise<IPersonalInfo | null> => {
  return PersonnalInfo.findOneAndUpdate(
    { owner_id: data.owner_id },
    { $set: data },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).exec();
};


/**
 *
 *
 * @return {*}  {(Promise<LeanPersonnalInfo | null>)}
 */
const get_personnal_info = async (): Promise<LeanPersonnalInfo | null> => {
  const personnalInfo = await PersonnalInfo.find()
    .lean<LeanPersonnalInfo>()
    .exec();
  if (personnalInfo) return personnalInfo;
  return null;
};


/**
 *
 *
 * @param {string} id
 * @return {*}  {(Promise<LeanPersonnalInfo | null>)}
 */
const get_personnal_info_by_id = async (
  id: string
): Promise<LeanPersonnalInfo | null> => {
  const personnalInfo = await PersonnalInfo.findById(id)
    .lean<LeanPersonnalInfo>()
    .exec();
  if (personnalInfo) return personnalInfo;
  return null;
};

/**
 *
 *
 * @param {(string | Types.ObjectId)} owner_id
 * @return {*}  {(Promise<LeanPersonnalInfo | null>)}
 */
const get_personnal_info_by_owner_id = async (
  owner_id: string | Types.ObjectId |any
): Promise<IPersonalInfo | null> => {
  try {
    const personnalInfo = await PersonnalInfo.findOne({ owner_id })
      .lean<LeanPersonnalInfo>()
      .exec();
    if (personnalInfo) return personnalInfo;
    return null;
  } catch (error) {
    throw error;
  }
};


/**
 *
 *
 * @param {string} keyword
 * @return {*}  {(Promise<IPersonalInfo | null>)}
 */
const search_personnal_info = async (keyword: string) : Promise<IPersonalInfo | null> => {
  try {
    const query: FilterQuery<IPersonalInfo> = {
      $or: [
        { firstName: { $regex: keyword, $options: "i" } },
        { lastName: { $regex: keyword, $options: "i" } },
        { cin: { $regex: keyword, $options: "i" } },
        { adresse: { $regex: keyword, $options: "i" } },
      ],
    };
    const personnalInfo = await PersonnalInfo.find(query)
      .lean<IPersonalInfo>()
      .exec();
    return personnalInfo ? personnalInfo : null;
  } catch (error) {
    throw error;
  }
};

const completPersonnalInfo = async (id: string, data: Partial<IPersonalInfo>): Promise<IPersonalInfo | null> => {
  try {
    const personnalInfo = await PersonnalInfo.findOneAndUpdate(
      { owner_id: id },
      { $set: { ...data, owner_id: id } },
      { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true },
    ).lean<IPersonalInfo>();
    return personnalInfo ? personnalInfo : null;
  } catch (error) {
    throw error;
  }
};

const removePersonnalInfo = async (id: string): Promise<IPersonalInfo | null> => {
  try {
    const personnalInfo = await PersonnalInfo.findByIdAndDelete(id).lean<IPersonalInfo>();
    return personnalInfo ? personnalInfo : null;
  } catch (error) {
    throw error;
  }
};

export {
    create_personnal_info,
    get_personnal_info,
    get_personnal_info_by_id,
    get_personnal_info_by_owner_id,
    search_personnal_info,
    completPersonnalInfo,
    removePersonnalInfo
};

