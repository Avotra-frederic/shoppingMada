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
  const personnalInfo = await PersonnalInfo.create(data);
  if (personnalInfo) return personnalInfo;
  return null;
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
  owner_id: string | Types.ObjectId
): Promise<LeanPersonnalInfo | null> => {
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

export {
    create_personnal_info,
    get_personnal_info,
    get_personnal_info_by_id,
    get_personnal_info_by_owner_id,
    search_personnal_info
};

