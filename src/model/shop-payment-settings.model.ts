import { model, models, Schema } from "mongoose";
import IShopPaymentSettings from "../interface/shop-payment-settings.interface";

const shopPaymentSettingsSchema = new Schema<IShopPaymentSettings>(
  {
    boutiks_id: { type: Schema.Types.ObjectId, ref: "Boutiks", required: true, unique: true, index: true },
    deliveryFee: { type: Number, min: 0, default: 0 },
    paymentMethods: [{
      method: {
        type: String,
        enum: ["mvola", "orange_money", "airtel_money", "virement", "paiement_livraison"],
        required: true,
      },
      enabled: { type: Boolean, default: true },
      recipientName: { type: String, required: true },
      account: String,
      phone: String,
      instructions: String,
    }],
  },
  { timestamps: true },
);

const ShopPaymentSettings = models.ShopPaymentSettings || model<IShopPaymentSettings>("ShopPaymentSettings", shopPaymentSettingsSchema);
export default ShopPaymentSettings;
