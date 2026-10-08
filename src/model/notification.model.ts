import { model, models, Schema, Types } from "mongoose";

const notificationSchema = new Schema({
  recipientId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  kind: { type: String, required: true, maxlength: 60, index: true },
  title: { type: String, required: true, maxlength: 140 },
  message: { type: String, required: true, maxlength: 500 },
  targetType: { type: String, maxlength: 60 },
  targetId: { type: String, maxlength: 120 },
  readAt: { type: Date, default: null, index: true },
}, { timestamps: true });
notificationSchema.index({ recipientId: 1, createdAt: -1 });
const Notification = models.Notification || model("Notification", notificationSchema);
export default Notification;
