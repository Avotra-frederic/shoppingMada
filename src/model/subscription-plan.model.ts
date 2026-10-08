import { model, models, Schema } from "mongoose";

const subscriptionPlanSchema = new Schema({
  key: { type: String, required: true, unique: true, enum: ["free", "pro"] },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  monthlyPriceMGA: { type: Number, min: 0, max: 1000000000, default: 0 },
  durationDays: { type: Number, min: 1, max: 366, default: 30 },
  graceDays: { type: Number, min: 0, max: 30, default: 3 },
  maxProducts: { type: Number, min: 0, max: 1000000, default: 0 },
  features: {
    advancedAnalytics: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
    customCategories: { type: Boolean, default: false },
  },
  active: { type: Boolean, default: true },
}, { timestamps: true });

const SubscriptionPlan = models.SubscriptionPlan || model("SubscriptionPlan", subscriptionPlanSchema);
export default SubscriptionPlan;
