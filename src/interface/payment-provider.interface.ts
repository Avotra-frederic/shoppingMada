import { PaymentMethod } from "./marketplace-order.interface";
import { IShopPaymentMethod } from "./shop-payment-settings.interface";

export interface PaymentInstructions {
  providerType: "manual";
  method: PaymentMethod;
  recipientName: string;
  account?: string;
  phone?: string;
  instructions?: string;
}

export interface PaymentProvider {
  readonly type: "manual";
  createInstructions(method: IShopPaymentMethod): PaymentInstructions;
}
