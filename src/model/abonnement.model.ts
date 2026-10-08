import { model, models, Schema } from "mongoose";
import ISubscription from "../interface/abonnement.interface";

const SubscriptionSheme = new Schema<ISubscription>({
    owner_id:{
        type:Schema.Types.ObjectId,
        ref:"User"
    },
    plan:{
        type:String,
        default:"Premium"
    },
    transactionPhoneNumber:{
        type:String
    },
    refTransaction:{
        type:String,
        unique:true
    },
    selectedPhoneNumber:{
        type:String
    },
    paymentMethodId: { type: String },
    paymentMethodName: { type: String },
    paymentAccountName: { type: String },
    paymentAccountNumber: { type: String },
    paymentInstructions: { type: String },
    priceMGA: { type: Number, min: 0 },
    startDate:{
        type: Date
    },
    endDate:{
        type:Date
    },
    payementStatus:{
        type:String,
        enum:["Pending","Completed","Rejected","Canceled"],
        default:"Pending"
    },
    motif: { type: String, maxlength: 500 },
    lifecycleStatus: { type: String, enum: ["active", "grace", "expired", "canceled"], index: true },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    canceledAt: Date,
    graceUntil: Date,
    autoRenew: { type: Boolean, default: false },
    refundedMGA: { type: Number, min: 0, default: 0 },
    paymentCompletedAt: { type: Date, index: true },
},{timestamps:true});

const Subscription = models.Subscription || model<ISubscription>("Subscription",SubscriptionSheme)

export default Subscription;
