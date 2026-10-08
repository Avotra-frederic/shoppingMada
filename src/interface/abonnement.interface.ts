import { Document, Types } from 'mongoose';
import IUser from './user.interface';


export default interface ISubscription extends Document{
    _id: Types.ObjectId
    owner_id: string | Types.ObjectId | IUser
    plan:string
    transactionPhoneNumber:string,
    refTransaction:string
    selectedPhoneNumber:string,
    payementStatus: "Pending" | "Completed" |"Rejected" | "Canceled"
    startDate: Date,
    endDate : Date
    motif?: string
    paymentMethodId?: string;
    paymentMethodName?: string;
    paymentAccountName?: string;
    paymentAccountNumber?: string;
    paymentInstructions?: string;
    priceMGA?: number;
    lifecycleStatus?: "active" | "grace" | "expired" | "canceled";
    cancelAtPeriodEnd?: boolean;
    canceledAt?: Date;
    graceUntil?: Date;
    autoRenew?: boolean;
    refundedMGA?: number;
    paymentCompletedAt?: Date;
}
