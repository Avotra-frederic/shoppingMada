import { Types } from "mongoose";
import IMarketplaceOrder, {
  IMarketplaceSubOrder,
  MarketplaceOrderStatus,
} from "../interface/marketplace-order.interface";
import MarketplaceOrder from "../model/marketplace-order.model";
import Product from "../model/product.model";

const terminalStatuses: MarketplaceOrderStatus[] = [
  "terminee",
  "annulee",
  "refusee",
  "expiree",
];

const deriveGlobalStatus = (subOrders: IMarketplaceSubOrder[]): MarketplaceOrderStatus => {
  if (subOrders.some((subOrder) => subOrder.status === "litige")) return "litige";
  if (subOrders.every((subOrder) => subOrder.status === "terminee")) return "terminee";
  if (subOrders.every((subOrder) => terminalStatuses.includes(subOrder.status))) {
    const statuses = new Set(subOrders.map((subOrder) => subOrder.status));
    return statuses.size === 1 ? subOrders[0].status : "partiellement_terminee";
  }

  const progress: MarketplaceOrderStatus[] = [
    "en_attente_vendeur",
    "en_attente_paiement",
    "paiement_declare",
    "paiement_confirme",
    "en_preparation",
    "expediee",
    "livree",
    "terminee",
  ];
  const active = subOrders
    .filter((subOrder) => !terminalStatuses.includes(subOrder.status))
    .map((subOrder) => subOrder.status)
    .sort((left, right) => progress.indexOf(left) - progress.indexOf(right));
  return active[0] ?? "partiellement_terminee";
};

const rollbackReservations = async (
  reservations: Array<{ product_id: Types.ObjectId; quantity: number; stockPath?: string }>,
) => {
  for (const reservation of reservations) {
    await Product.updateOne(
      { _id: reservation.product_id },
      { $inc: { [reservation.stockPath ?? "stock"]: reservation.quantity } },
    );
  }
};
const reserveSubOrderStock = async (subOrder: IMarketplaceSubOrder) => {
const quantities = new Map<
    string,
    { quantity: number; variants: Record<string, string> }
  >();
  for (const item of subOrder.items) {
    const productId = String(item.product_id);
    const variants = item.variants ?? {};
    const variantKey = JSON.stringify(
      Object.entries(variants).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    );
    const key = `${productId}:${variantKey}`;
    const existing = quantities.get(key);
    quantities.set(key, {
      quantity: (existing?.quantity ?? 0) + item.quantity,
      variants,
    });
  }

  const reservations: Array<{
    product_id: Types.ObjectId;
    quantity: number;
    stockPath?: string;
  }> = [];
  try {
    for (const [key, requested] of quantities) {
      const productId = key.slice(0, key.indexOf(":"));
      const quantity = requested.quantity;
      const product = await Product.findById(productId)
        .select("stock variant")
        .lean<any>();
      if (!product) throw new Error("Un produit de la commande n’est plus disponible.");
      const selections = Object.entries(requested.variants);

      if (selections.length) {
        if (!Array.isArray(product.variant)) throw new Error("Les options de produit ne sont plus disponibles.");
        for (const [name, value] of selections) {
          const variantIndex = product.variant.findIndex(
            (entry: any) => entry.name === name,
          );
          const variant = product.variant[variantIndex];
          const optionIndex =
            variant?.values?.findIndex((entry: any) => entry.value === value) ??
            -1;
          if (!variant || optionIndex < 0) throw new Error("Une option de produit n’est plus disponible.");
          if (typeof variant.values[optionIndex].stock !== "number") {
            throw new Error("Le stock de cette option n’est pas défini.");
          }

          const stockPath = `variant.${variantIndex}.values.${optionIndex}.stock`;
          const reserved = await Product.findOneAndUpdate(
            { _id: productId, [stockPath]: { $gte: quantity } },
            { $inc: { [stockPath]: -quantity } },
            { new: true },
          )
            .select("_id")
            .lean();
          if (!reserved) throw new Error("Stock insuffisant pour une option du panier.");
          reservations.push({
            product_id: new Types.ObjectId(productId),
            quantity,
            stockPath,
          });
        }
      } else if (typeof product.stock === "number") {
        const reserved = await Product.findOneAndUpdate(
          { _id: productId, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
          { new: true },
        )
          .select("_id")
          .lean();
        if (!reserved) throw new Error("Stock insuffisant pour un ou plusieurs produits.");
        reservations.push({ product_id: new Types.ObjectId(productId), quantity });
      }
    }
    return reservations;
  } catch (error) {
    await rollbackReservations(reservations);
    throw error;
  }
};
const createMarketplaceOrder = async (
  data: Partial<IMarketplaceOrder> & { subOrders: IMarketplaceSubOrder[] },
): Promise<IMarketplaceOrder> => {
  const reservations: Array<{
    product_id: Types.ObjectId;
    quantity: number;
    stockPath?: string;
  }> = [];
  try {
    for (const subOrder of data.subOrders) {
      subOrder.reservations = await reserveSubOrderStock(subOrder);
      reservations.push(...subOrder.reservations);
    }
    const [order] = await MarketplaceOrder.create([data]);
    return order;
  } catch (error) {
    await rollbackReservations(reservations);
    throw error;
  }
};

const updateSubOrder = async (
  orderId: string,
  subOrderId: string,
  updates: Record<string, unknown>,
  options: { expectedStatus?: MarketplaceOrderStatus; actor?: string; note?: string } = {},
) => {
  const subOrderIdObject = new Types.ObjectId(subOrderId);
  const elementMatch: Record<string, unknown> = { _id: subOrderIdObject };
  const filter: Record<string, unknown> = { _id: orderId };
  if (options.expectedStatus) elementMatch.status = options.expectedStatus;
  filter.subOrders = { $elemMatch: elementMatch };

  const setValues: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    setValues[`subOrders.$[sub].${key}`] = value;
  }

  const update: Record<string, unknown> = { $set: setValues };
  if (options.actor) {
    update.$push = {
      "subOrders.$[sub].statusHistory": {
        status: updates.status ?? options.expectedStatus,
        actor: options.actor,
        note: options.note,
        createdAt: new Date(),
      },
    };
  }

  const arrayFilter: Record<string, unknown> = { "sub._id": subOrderIdObject };
  if (options.expectedStatus) arrayFilter["sub.status"] = options.expectedStatus;
  const updated = await MarketplaceOrder.findOneAndUpdate(filter, update, {
    new: true,
    runValidators: true,
    arrayFilters: [arrayFilter],
  });
  if (!updated) return null;
  return refreshGlobalStatus(orderId);
};

const refreshGlobalStatus = async (orderId: string) => {
  const order = await MarketplaceOrder.findById(orderId);
  if (!order) return null;
  order.status = deriveGlobalStatus(order.subOrders as unknown as IMarketplaceSubOrder[]);
  await order.save();
  return order;
};

const releaseSubOrderStock = async (orderId: string, subOrderId: string) => {
  const order = await MarketplaceOrder.findById(orderId).select("subOrders").lean<any>();
  const subOrder = order?.subOrders.find((item: any) => String(item._id) === subOrderId);
  if (!subOrder || subOrder.stockReleased) return;

  const claimed = await MarketplaceOrder.updateOne(
    { _id: orderId, subOrders: { $elemMatch: { _id: subOrder._id, stockReleased: { $ne: true } } } },
    { $set: { "subOrders.$[sub].stockReleased": true } },
    { arrayFilters: [{ "sub._id": subOrder._id, "sub.stockReleased": { $ne: true } }] },
  );
  if (!claimed.modifiedCount) return;

  await rollbackReservations(subOrder.reservations ?? []);
};

const processExpiredMarketplaceOrders = async (now = new Date()) => {
  const orders = await MarketplaceOrder.find({
    subOrders: {
      $elemMatch: {
        status: { $in: ["en_attente_vendeur", "en_attente_paiement"] },
        expiresAt: { $lte: now },
      },
    },
  }).select("_id subOrders").lean();

  for (const order of orders) {
    for (const subOrder of order.subOrders as unknown as IMarketplaceSubOrder[]) {
      if (
        !subOrder.expiresAt || subOrder.expiresAt > now ||
        !["en_attente_vendeur", "en_attente_paiement"].includes(subOrder.status)
      ) continue;

      const updated = await updateSubOrder(
        String(order._id),
        String(subOrder._id),
        { status: "expiree", expiresAt: null },
        { expectedStatus: subOrder.status, actor: "system", note: "Expiration automatique." },
      );
      if (updated) await releaseSubOrderStock(String(order._id), String(subOrder._id));
    }
  }
};

const findOrderById = (id: string, includeTokenHash = false) => {
  const query = MarketplaceOrder.findById(id)
    .populate("owner_id", "username email phonenumber")
    .populate("subOrders.boutiks_id", "name phoneNumber whatsappNumber email logo ville adresse");
  return includeTokenHash ? query.select("+trackingTokenHash") : query;
};

export {
  createMarketplaceOrder,
  deriveGlobalStatus,
  findOrderById,
  processExpiredMarketplaceOrders,
  refreshGlobalStatus,
  releaseSubOrderStock,
  updateSubOrder,
};




