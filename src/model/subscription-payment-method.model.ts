import { model, models, Schema } from "mongoose";
import SubscriptionPaymentSettings from "../interface/subscription-payment-method.interface";

const paymentMethodSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    accountName: { type: String, required: true, trim: true, maxlength: 120 },
    accountNumber: { type: String, required: true, trim: true, maxlength: 40 },
    instructions: { type: String, trim: true, maxlength: 500, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { _id: true },
);

const settingsSchema = new Schema<SubscriptionPaymentSettings>(
  {
    key: { type: String, unique: true, default: "default" },
    monthlyPriceMGA: { type: Number, min: 0, default: 50000 },
    methods: { type: [paymentMethodSchema], default: [] },
  },
  { timestamps: true },
);

const SubscriptionPaymentSettingsModel =
  models.SubscriptionPaymentSettings ||
  model<SubscriptionPaymentSettings>("SubscriptionPaymentSettings", settingsSchema);

export default SubscriptionPaymentSettingsModel;