import { model, models, Schema } from "mongoose";
import IPersonalInfo from "../interface/personnal_info.interface";

const personalInfoSheme = new Schema<IPersonalInfo>({
    firstName:{
        type: String,
        required: true,
    },
    lastName:{
        type: String,
        required:true,
    },
    gender:{
        type: String,
        required:true
    },
    adresse:{
        type: String,
        required:true
    },
    cin:{
        type: String
    },
    owner_id:{
        type: Schema.Types.ObjectId,
        ref: "User",
        required:true,
    }
});

const PersonnalInfo = models.PersonnalInfo || model<IPersonalInfo>("PersonnalInfo",personalInfoSheme);
export default PersonnalInfo;
