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
    whatsappNumber: { type: String, trim: true, maxlength: 24 },
    email:{
        type: String,
        required: true,
    },
    logo:{
        type: String,
    },
    ville:{
        type:String
    },
    description: {
        type: String,
        trim: true,
        maxlength: 1000,
    },
    websiteUrl: { type: String, trim: true },
    facebookUrl: { type: String, trim: true },
    instagramUrl: { type: String, trim: true },
    tiktokUrl: { type: String, trim: true },
    youtubeUrl: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    issuer: {
        type:String
    },
    product_category : {
        type: [String],
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
    },
    commissionPercent: { type: Number, min: 0, max: 50, default: 0 },
    payoutStatus: { type: String, enum: ["manual", "pending", "paid"], default: "manual" },
    payoutReference: { type: String, maxlength: 120 },
    subscription_id:{
        type:Schema.Types.ObjectId,
        ref:"Subscription"
    }
},{
    timestamps: true,
});

const Boutiks = models.Boutiks || model("Boutiks", BoutiksSheme);

export default Boutiks;
