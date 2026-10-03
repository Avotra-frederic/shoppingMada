import { Document, Types } from "mongoose";

export const MARKET_ORDER_STATUSES = [
  "en_attente_vendeur",
  "en_attente_paiement",
  "paiement_declare",
  "paiement_confirme",
  "en_preparation",
  "expediee",
  "livree",
  "terminee",
  "annulee",
  "refusee",
  "expiree",
  "litige",
  "partiellement_terminee",
] as const;

export type MarketplaceOrderStatus = (typeof MARKET_ORDER_STATUSES)[number];
export type PaymentMethod =
  | "mvola"
  | "orange_money"
  | "airtel_money"
  | "virement"
  | "paiement_livraison";

export interface IOrderItemSnapshot {
  product_id: Types.ObjectId;
  name: string;
  unitPrice: number;
  quantity: number;
  image?: string;
  variants: Record<string, string>;
}

export interface IStockReservation {
  product_id: Types.ObjectId;
  quantity: number;
}

export interface IMarketplaceSubOrder {
  _id?: Types.ObjectId;
  boutiks_id: Types.ObjectId;
  items: IOrderItemSnapshot[];
  subtotal: number;
  deliveryFee: number;
  payableTotal: number;
  paymentMethod: PaymentMethod;
  paymentProviderType: "manual";
  paymentInstructions: {
    recipientName: string;
    account?: string;
    phone?: string;
    instructions?: string;
  };
  paymentStatus: "a_payer" | "declare" | "confirme";
  status: MarketplaceOrderStatus;
  disputePreviousStatus?: MarketplaceOrderStatus;
  expiresAt?: Date;
  reservations: IStockReservation[];
  stockReleased: boolean;
  shipping: {
    address: string;
    city?: string;
    recipientName: string;
    phone: string;
    carrier?: string;
    trackingNumber?: string;
  };
  paymentDeclaration?: {
    reference: string;
    evidencePath?: string;
    declaredAt: Date;
  };
  statusHistory: Array<{
    status: MarketplaceOrderStatus;
    actor: string;
    note?: string;
    createdAt: Date;
  }>;
}

export default interface IMarketplaceOrder extends Document {
  owner_id?: Types.ObjectId;
  customer: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    city?: string;
  };
  trackingTokenHash?: string;
  status: MarketplaceOrderStatus;
  subOrders: IMarketplaceSubOrder[];
  createdAt: Date;
  updatedAt: Date;
}
