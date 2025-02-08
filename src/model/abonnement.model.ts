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
    startDate:{
        type: Date
    },
    endDate:{
        type:Date
    },
    payementStatus:{
        type:String,
        enum:["Pending","Pompleted","Rejected","Canceled"],
        default:"Pending"
    }
},{timestamps:true});

const Subscription = models.Subscription || model<ISubscription>("Subscription",SubscriptionSheme)

export default Subscription;