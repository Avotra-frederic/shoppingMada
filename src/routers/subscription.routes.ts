import { Router } from "express";
import { auth } from "../middleware/auth.middleware";
import { cancelCurrentSubscription, getSubscriptionList, getSubscriptionPaymentOptions, listPublicSubscriptionPlans, recordSubscriptionRefund, sendNewSubscription, updateNewSubscription, updateSubscriptionPaymentOptions } from "../controller/subscription.controller";

const subscriptionRoute = Router();
subscriptionRoute.get("/subscription/plans", listPublicSubscriptionPlans);
subscriptionRoute.get("/subscription/payment-methods", auth, getSubscriptionPaymentOptions);
subscriptionRoute.put("/subscription/payment-methods", auth, updateSubscriptionPaymentOptions);
subscriptionRoute.post("/subscribe",auth,sendNewSubscription);
subscriptionRoute.put("/subscribe/:id",auth,updateNewSubscription);
subscriptionRoute.post("/subscription/:id/cancel", auth, cancelCurrentSubscription);
subscriptionRoute.post("/admin/subscription/:id/refunds", auth, recordSubscriptionRefund);
subscriptionRoute.get("/subscription/:id?", auth, getSubscriptionList);

export default subscriptionRoute;
