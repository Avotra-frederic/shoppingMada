import { model, models, Schema } from "mongoose";

const platformSettingsSchema = new Schema({
  key: { type: String, required: true, unique: true, default: "default" },
  currencyRates: {
    EUR: { type: Number, min: 1 },
    USD: { type: Number, min: 1 },
    updatedAt: Date,
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
}, { timestamps: true });
const PlatformSettings = models.PlatformSettings || model("PlatformSettings", platformSettingsSchema);
export default PlatformSettings;
