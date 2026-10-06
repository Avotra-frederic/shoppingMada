import { Document, Types } from "mongoose";

export interface SubscriptionPaymentMethod {
  _id?: Types.ObjectId | string;
  name: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
  isActive: boolean;
}

export default interface SubscriptionPaymentSettings extends Document {
  key: string;
  monthlyPriceMGA: number;
  methods: SubscriptionPaymentMethod[];
}