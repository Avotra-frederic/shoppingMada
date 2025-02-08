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
    }
},{
    timestamps: true
});

const User = models.User || model<IUser>("User",userScheme);
export default User;
