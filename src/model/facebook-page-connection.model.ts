import { model, models, Schema, Types } from "mongoose";

const FacebookPageConnectionSchema = new Schema({
  connectionKey: { type: String, default: "primary", unique: true },
  pageId: { type: String, required: true, unique: true, index: true },
  pageName: { type: String, required: true },
  encryptedAccessToken: { type: String, required: true, select: false },
  connectedBy: { type: Types.ObjectId, ref: "User", required: true },
  connectedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default models.FacebookPageConnection || model("FacebookPageConnection", FacebookPageConnectionSchema);
