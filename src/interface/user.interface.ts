import { Types } from "mongoose";
import { Document } from "mongoose";

export default interface IUser extends Document
{
    username: string,
    email:string,
    phonenumber:string,
    emailVerifyAt?:Date,
    emailOtpHash?: string,
    emailOtpExpiresAt?: Date,
    emailOtpAttempts?: number,
    adminStepUpOtpHash?: string,
    adminStepUpOtpExpiresAt?: Date,
    adminStepUpOtpAttempts?: number,
    adminStepUpLastSentAt?: Date,
    adminStepUpTokenHash?: string,
    adminStepUpTokenExpiresAt?: Date,
    password: string,
    photos?: string,
    boutiks_id? : Types.ObjectId | string,
    personnalInfo_id : Types.ObjectId
    userGroupMember_id:Types.ObjectId
    preferences?: { language?: "fr" | "en"; currency?: "MGA" | "EUR" | "USD"; notifications?: { orders?: boolean; support?: boolean; promotions?: boolean } };
    savedAddresses?: Array<{ _id?: Types.ObjectId | string; label?: string; recipientName: string; phone: string; address: string; city?: string }>;
}
export type LeanUser = Omit<IUser, '_id'> & { _id: Types.ObjectId };
