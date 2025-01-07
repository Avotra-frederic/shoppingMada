import { model, models, Schema, Types } from "mongoose";

const BoutiksSheme = new Schema({
    name: {
        type: String,
        required: true,
    },
    adresse:{
        type: String,
        required: true,
    },
    phoneNumber:{
        type: String,
        required: true,
    },
    email:{
        type: String,
        required: true,
    },
    logo:{
        type: String,
    },
    issuer: {
        type:String
    },
    product_category : {
        type: [Types.ObjectId]
    },
    owner_id:{
        type: Types.ObjectId,
        ref: "User",
        required: true,
    },
    plan:{
        type: String,
        required: true,
        enum: ["free", "pro"],
        default: "free"
    }
},{
    timestamps: true,
});

const Boutiks = models.Boutiks || model("Boutiks", BoutiksSheme);

export default Boutiks;
