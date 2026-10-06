import SubscriptionPaymentSettingsModel from "../model/subscription-payment-method.model";
import {
  SubscriptionPaymentMethod,
  default as SubscriptionPaymentSettings,
} from "../interface/subscription-payment-method.interface";

const getSubscriptionPaymentMethods = async (
  activeOnly = false,
): Promise<{ monthlyPriceMGA: number; methods: SubscriptionPaymentMethod[] }> => {
  const settings = await SubscriptionPaymentSettingsModel.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default", methods: [] } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean<SubscriptionPaymentSettings>();
  const methods = (settings?.methods ?? []) as SubscriptionPaymentMethod[];
  return {
    monthlyPriceMGA: settings?.monthlyPriceMGA ?? 50000,
    methods: activeOnly ? methods.filter((method) => method.isActive) : methods,
  };
};

const saveSubscriptionPaymentMethods = async (
  methods: SubscriptionPaymentMethod[],
  monthlyPriceMGA: number,
): Promise<{ monthlyPriceMGA: number; methods: SubscriptionPaymentMethod[] }> => {
  const settings = await SubscriptionPaymentSettingsModel.findOneAndUpdate(
    { key: "default" },
    { $set: { methods, monthlyPriceMGA } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean<SubscriptionPaymentSettings>();
  return {
    monthlyPriceMGA: settings?.monthlyPriceMGA ?? monthlyPriceMGA,
    methods: (settings?.methods ?? []) as SubscriptionPaymentMethod[],
  };
};

const findActiveSubscriptionPaymentMethod = async (
  id: string,
): Promise<SubscriptionPaymentMethod | undefined> => {
  const configuration = await getSubscriptionPaymentMethods(true);
  return configuration.methods.find((method) => String(method._id) === id);
};

export {
  getSubscriptionPaymentMethods,
  saveSubscriptionPaymentMethods,
  findActiveSubscriptionPaymentMethod,
};