import { model, models, Schema } from 'mongoose';
const userGroupScheme = new Schema({
    name:{
        type: String,
        required: true,
        enum: ["Super Admin", "Boutiks", "Client",]
    }
},{
    timestamps: true,
})

const UserGroup = models.UserGroup || model("UserGroup",userGroupScheme);
export default UserGroup;
