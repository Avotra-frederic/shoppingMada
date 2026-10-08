import { Router } from "express";
import { auth } from "../middleware/auth.middleware";
import optionalAuth from "../middleware/optional-auth.middleware";
import paymentEvidence from "../middleware/payment-evidence.middleware";
import requireAdminStepUp from "../middleware/admin-step-up.middleware";
import {
  authorizePaymentEvidenceUpload,
  configurePaymentMethods,
  confirmPayment,
  createOrder,
  declarePayment,
  getOrderForTracking,
  getPaymentEvidence,
  getPublicPaymentMethods,
  getSellerPaymentMethods,
  getSellerOrderSummary,
  listDisputes,
  listOrders,
  resolveDispute,
  updateSubOrderStatus,
} from "../controller/marketplace-order.controller";

const marketplaceOrderRoutes = Router();

marketplaceOrderRoutes.get("/marketplace/orders/payment-methods/:shopId", getPublicPaymentMethods);
marketplaceOrderRoutes.get("/marketplace/orders/track/:orderId", optionalAuth, getOrderForTracking);
marketplaceOrderRoutes.get("/marketplace/orders/:orderId/suborders/:subOrderId/evidence", optionalAuth, getPaymentEvidence);
marketplaceOrderRoutes.get("/marketplace/orders/seller/payment-methods", auth, getSellerPaymentMethods);
marketplaceOrderRoutes.get("/marketplace/orders/seller/summary", auth, getSellerOrderSummary);
marketplaceOrderRoutes.put("/marketplace/orders/seller/payment-methods", auth, configurePaymentMethods);
marketplaceOrderRoutes.get("/marketplace/orders/disputes", auth, listDisputes);
marketplaceOrderRoutes.get("/marketplace/orders", auth, listOrders);
marketplaceOrderRoutes.post("/marketplace/orders", optionalAuth, createOrder);
marketplaceOrderRoutes.patch(
  "/marketplace/orders/:orderId/suborders/:subOrderId/payment",
  optionalAuth,
  authorizePaymentEvidenceUpload,
  paymentEvidence,
  declarePayment,
);
marketplaceOrderRoutes.patch(
  "/marketplace/orders/:orderId/suborders/:subOrderId/confirm-payment",
  auth,
  confirmPayment,
);
marketplaceOrderRoutes.patch(
  "/marketplace/orders/:orderId/suborders/:subOrderId/status",
  optionalAuth,
  updateSubOrderStatus,
);
marketplaceOrderRoutes.patch(
  "/marketplace/orders/:orderId/suborders/:subOrderId/resolve",
  auth,
  requireAdminStepUp,
  resolveDispute,
);

export default marketplaceOrderRoutes;
