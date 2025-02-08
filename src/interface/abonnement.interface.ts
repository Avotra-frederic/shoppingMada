import { Document, Schema } from 'mongoose';
import IUser from './user.interface';


export default interface ISubscription extends Document{
    _id:string | Schema.Types.ObjectId
    owner_id: string | Schema.Types.ObjectId | IUser
    plan:string
    transactionPhoneNumber:string,
    refTransaction:string
    selectedPhoneNumber:string,
    payementStatus: "Pending" | "Completed" |"Rejected" | "Canceled"
    startDate: Date,
    endDate : Date
}