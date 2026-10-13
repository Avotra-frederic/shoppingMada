import { model, models, Schema, Types } from "mongoose";

const FacebookOAuthTransactionSchema = new Schema({
  stateHash: { type: String, required: true, unique: true },
  adminId: { type: Types.ObjectId, ref: "User", required: true },
  handoffHash: { type: String },
  candidates: [{ pageId: String, pageName: String, tasks: [String], encryptedAccessToken: String }],
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export default models.FacebookOAuthTransaction || model("FacebookOAuthTransaction", FacebookOAuthTransactionSchema);
