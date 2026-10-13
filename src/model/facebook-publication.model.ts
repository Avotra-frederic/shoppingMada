import { model, models, Schema, Types } from "mongoose";

const FacebookPublicationSchema = new Schema({
  productId: { type: Types.ObjectId, ref: "Product", required: true, index: true },
  pageId: { type: String, required: true, index: true },
  pageName: { type: String, required: true },
  status: { type: String, enum: ["publishing", "published", "failed"], required: true, index: true },
  graphPostId: String,
  permalink: String,
  caption: String,
  publishedBy: { type: Types.ObjectId, ref: "User", required: true },
  publishedAt: Date,
  errorMessage: { type: String, maxlength: 500 },
  attemptCount: { type: Number, default: 1 },
}, { timestamps: true });

FacebookPublicationSchema.index({ productId: 1, pageId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: "publishing" } });
export default models.FacebookPublication || model("FacebookPublication", FacebookPublicationSchema);
