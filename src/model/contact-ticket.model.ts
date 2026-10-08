import { model, models, Schema, Types } from "mongoose";

const contactTicketSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  ownerId: { type: Types.ObjectId, ref: "User", index: true },
  subject: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, maxlength: 4000 },
  status: { type: String, enum: ["open", "in_progress", "resolved"], default: "open", index: true },
  priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal", index: true },
  dueAt: { type: Date, index: true },
  adminNote: { type: String, maxlength: 1000 },
  assignedTo: { type: Types.ObjectId, ref: "User" },
  resolvedAt: Date,
  replies: [{
    authorId: { type: Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 4000 },
    sentAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

contactTicketSchema.index({ status: 1, createdAt: -1 });
const ContactTicket = models.ContactTicket || model("ContactTicket", contactTicketSchema);
export default ContactTicket;
