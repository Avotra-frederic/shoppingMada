import { model, models, Schema } from "mongoose";
import IPersonalInfo from "../interface/personnal_info.interface";

const personalInfoSheme = new Schema<IPersonalInfo>({
    firstName:{
        type: String,
    },
    lastName:{
        type: String,
    },
    phoneNumber:{
        type:String
    },
    gender:{
        type: String
    },
    adresse:{
        type: String
    },
    cin:{
        type: String
    },
    frontImage:{
        type: String
    },
    backImage:{
        type: String
    },
    verificationStatus: {
        type: String,
        enum: ["not_submitted", "pending", "approved", "rejected"],
        default: "not_submitted",
        index: true,
    },
    verificationReason: { type: String, maxlength: 500 },
    reviewedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    owner_id:{
        type: Schema.Types.ObjectId,
        ref: "User",
        required:true,
    }
});

const PersonnalInfo = models.PersonnalInfo || model<IPersonalInfo>("PersonnalInfo",personalInfoSheme);
export default PersonnalInfo;
