import { Router } from "express";
import { auth } from "../middleware/auth.middleware";
import { getSubscriptionList, getSubscriptionPaymentOptions, sendNewSubscription, updateNewSubscription, updateSubscriptionPaymentOptions } from "../controller/subscription.controller";

const subscriptionRoute = Router();
subscriptionRoute.get("/subscription/payment-methods", auth, getSubscriptionPaymentOptions);
subscriptionRoute.put("/subscription/payment-methods", auth, updateSubscriptionPaymentOptions);
subscriptionRoute.post("/subscribe",auth,sendNewSubscription);
subscriptionRoute.put("/subscribe/:id",auth,updateNewSubscription);
subscriptionRoute.get("/subscription/:id?", auth, getSubscriptionList);

export default subscriptionRoute;