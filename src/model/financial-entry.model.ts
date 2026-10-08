import { model, models, Schema, Types } from "mongoose";

const financialEntrySchema = new Schema({
  kind: { type: String, enum: ["subscription_payment", "marketplace_payment", "refund", "seller_payout"], required: true, index: true },
  amountMGA: { type: Number, required: true, min: 0 },
  sourceId: { type: String, required: true, index: true },
  sourceType: { type: String, required: true },
  ownerId: { type: Types.ObjectId, ref: "User", index: true },
  note: { type: String, maxlength: 500, default: "" },
  actorId: { type: Types.ObjectId, ref: "User" },
}, { timestamps: true });
financialEntrySchema.index({ kind: 1, sourceId: 1 });
financialEntrySchema.index({ createdAt: -1 });
const FinancialEntry = models.FinancialEntry || model("FinancialEntry", financialEntrySchema);
export default FinancialEntry;
