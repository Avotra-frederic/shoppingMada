import { Document, Types } from "mongoose";
import { PaymentMethod } from "./marketplace-order.interface";

export interface IShopPaymentMethod {
  method: PaymentMethod;
  enabled: boolean;
  recipientName: string;
  account?: string;
  phone?: string;
  instructions?: string;
}

export default interface IShopPaymentSettings extends Document {
  boutiks_id: Types.ObjectId;
  deliveryFee: number;
  paymentMethods: IShopPaymentMethod[];
  updatedAt: Date;
}
