import { IShopPaymentMethod } from "../interface/shop-payment-settings.interface";
import { PaymentProvider } from "../interface/payment-provider.interface";

const manualProvider: PaymentProvider = {
  type: "manual",
  createInstructions: (method: IShopPaymentMethod) => ({
    providerType: "manual",
    method: method.method,
    recipientName: method.recipientName,
    account: method.account,
    phone: method.phone,
    instructions: method.instructions,
  }),
};

const paymentProviders: Record<PaymentProvider["type"], PaymentProvider> = {
  manual: manualProvider,
};

export const getPaymentProvider = (type: PaymentProvider["type"]): PaymentProvider =>
  paymentProviders[type];
