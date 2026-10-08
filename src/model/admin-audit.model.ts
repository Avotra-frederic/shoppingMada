import { model, models, Schema, Types } from "mongoose";

const adminAuditSchema = new Schema({
  actorId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  actorName: { type: String, required: true },
  action: { type: String, required: true, index: true },
  targetType: { type: String, required: true, index: true },
  targetId: { type: String, required: true, index: true },
  targetLabel: { type: String, default: "" },
  reason: { type: String, maxlength: 1000, default: "" },
  metadata: { type: Schema.Types.Mixed, default: {} },
  ip: { type: String, maxlength: 80 },
}, { timestamps: true });

adminAuditSchema.index({ createdAt: -1 });
const AdminAudit = models.AdminAudit || model("AdminAudit", adminAuditSchema);
export default AdminAudit;
