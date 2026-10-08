import { model, models, Schema, Types } from "mongoose";
import IUser from "../interface/user.interface";

const userScheme = new Schema<IUser>({
    username: {
        type : String,
        required : true,
        trim: true
    },
    phonenumber:{
        type: String,
        required: true
    },
    email:{
        type: String,
        required: true,
        unique : true,
        lowercase: true
    },
    emailVerifyAt:{
        type: Date,
    },
    emailOtpHash: { type: String, select: false },
    emailOtpExpiresAt: { type: Date, select: false },
    emailOtpAttempts: { type: Number, default: 0, select: false },
    adminStepUpOtpHash: { type: String, select: false },
    adminStepUpOtpExpiresAt: { type: Date, select: false },
    adminStepUpOtpAttempts: { type: Number, select: false },
    adminStepUpLastSentAt: { type: Date, select: false },
    adminStepUpTokenHash: { type: String, select: false },
    adminStepUpTokenExpiresAt: { type: Date, select: false },
    password:{
        type: String,
        required : true,
        minlength : 4
    },
    photos:{
        type: String
    },
    boutiks_id:{
        type:Schema.Types.ObjectId,
        ref:'Boutiks'
    },
    personnalInfo_id:{
        type:Schema.Types.ObjectId,
        ref:"PersonnalInfo"
    },
    userGroupMember_id:{
        type:Schema.Types.ObjectId,
        ref : "UserGroupMember"
    },
    preferences: {
        language: { type: String, enum: ["fr", "en"] },
        currency: { type: String, enum: ["MGA", "EUR", "USD"], default: "MGA" },
        notifications: {
            orders: { type: Boolean, default: true },
            support: { type: Boolean, default: true },
            promotions: { type: Boolean, default: false },
        },
    }
    ,savedAddresses: [{ label: { type: String, trim: true, maxlength: 40 }, recipientName: { type: String, required: true, trim: true, maxlength: 120 }, phone: { type: String, required: true, trim: true, maxlength: 40 }, address: { type: String, required: true, trim: true, maxlength: 300 }, city: { type: String, trim: true, maxlength: 100 } }]
},{
    timestamps: true
});

const User = models.User || model<IUser>("User",userScheme);
export default User;
