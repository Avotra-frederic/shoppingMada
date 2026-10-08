import { model, models, Schema, Types } from "mongoose";
import IMarketplaceOrder, { MARKET_ORDER_STATUSES } from "../interface/marketplace-order.interface";

const itemSnapshotSchema = new Schema(
  {
    product_id: { type: Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    image: String,
    variants: { type: Map, of: String, default: {} },
  },
  { _id: false },
);

const reservationSchema = new Schema(
  {
    product_id: { type: Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    stockPath: { type: String },
  },
  { _id: false },
);

const subOrderSchema = new Schema(
  {
    boutiks_id: { type: Types.ObjectId, ref: "Boutiks", required: true, index: true },
    items: { type: [itemSnapshotSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    commissionPercent: { type: Number, min: 0, max: 50, default: 0 },
    deliveryFee: { type: Number, required: true, min: 0 },
    payableTotal: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["mvola", "orange_money", "airtel_money", "virement", "paiement_livraison"],
      required: true,
    },
    paymentProviderType: { type: String, enum: ["manual"], required: true, default: "manual" },
    paymentInstructions: {
      recipientName: { type: String, required: true },
      account: String,
      phone: String,
      instructions: String,
    },
    paymentStatus: { type: String, enum: ["a_payer", "declare", "confirme"], required: true, default: "a_payer" },
    paymentConfirmedAt: Date,
    invoiceNumber: { type: String, trim: true, maxlength: 60 },
    invoiceIssuedAt: Date,
    status: { type: String, enum: MARKET_ORDER_STATUSES, required: true },
    disputePreviousStatus: { type: String, enum: MARKET_ORDER_STATUSES },
    expiresAt: Date,
    reservations: { type: [reservationSchema], default: [] },
    stockReleased: { type: Boolean, default: false },
    shipping: {
      address: { type: String, required: true },
      city: String,
      recipientName: { type: String, required: true },
      phone: { type: String, required: true },
      carrier: String,
      trackingNumber: String,
    },
    paymentDeclaration: {
      reference: String,
      evidencePath: String,
      declaredAt: Date,
    },
    statusHistory: [{
      status: { type: String, enum: MARKET_ORDER_STATUSES, required: true },
      actor: { type: String, required: true },
      note: String,
      createdAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true },
);

const marketplaceOrderSchema = new Schema<IMarketplaceOrder>(
  {
    owner_id: { type: Types.ObjectId, ref: "User", index: true },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: String,
      address: { type: String, required: true },
      city: String,
    },
    trackingTokenHash: { type: String, select: false },
    status: { type: String, enum: MARKET_ORDER_STATUSES, required: true },
    subOrders: { type: [subOrderSchema], required: true },
  },
  { timestamps: true },
);

marketplaceOrderSchema.index({ "subOrders.boutiks_id": 1, createdAt: -1 });
marketplaceOrderSchema.index({ "subOrders.status": 1, "subOrders.expiresAt": 1 });

const MarketplaceOrder = models.MarketplaceOrder || model<IMarketplaceOrder>("MarketplaceOrder", marketplaceOrderSchema);
export default MarketplaceOrder;
