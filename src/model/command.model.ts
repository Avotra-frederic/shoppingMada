import { model, models, Schema } from "mongoose";
import ICommand from "../interface/command.interface";

const commandeSheme = new Schema<ICommand>({
    product_id :{
        type : Schema.Types.ObjectId,
        ref : "Product"
    },
    quantity :{
        type : Number,
        required: true
    },
    owner_id :{
        type : Schema.Types.ObjectId,
        ref: "User"
    },
    boutiks_id :{
        type : Schema.Types.ObjectId,
        ref: "Boutiks"
    },
    variants:{
        type:Map,
        of: String
    },
    total:{
        type: Number,
    },
    status :{
        type: String,
        enum : ["Pending", "Accepted", "Rejected","Canceled"],
        default : "Pending"
    }
},{timestamps: true})

const Command = models.Command || model<ICommand>("Command", commandeSheme);
export default Command;