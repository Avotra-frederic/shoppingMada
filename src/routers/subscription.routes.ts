import { Router } from "express";
import { auth } from "../middleware/auth.middleware";
import {  getSubscriptionList, sendNewSubscription, updateNewSubscription } from "../controller/subscription.controller";

const subscriptionRoute = Router();
subscriptionRoute.post("/subscribe",auth,sendNewSubscription);
subscriptionRoute.put("/subscribe/:id",auth,updateNewSubscription);
subscriptionRoute.get("/subscription/:id?", auth, getSubscriptionList);

export default subscriptionRoute;