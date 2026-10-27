import { Router } from "express";
import { auth } from "../middleware/auth.middleware";
import { getCurrencyRates, listNotifications, markNotificationRead, updateUserPreferences, updateThemePreference, getSavedAddresses, addSavedAddress, deleteSavedAddress } from "../controller/notification.controller";

const notificationRoutes = Router();
notificationRoutes.get("/notifications", auth, listNotifications);
notificationRoutes.get("/currency-rates", auth, getCurrencyRates);
notificationRoutes.get("/user/addresses", auth, getSavedAddresses);
notificationRoutes.post("/user/addresses", auth, addSavedAddress);
notificationRoutes.delete("/user/addresses/:id", auth, deleteSavedAddress);
notificationRoutes.put("/notifications/:id/read", auth, markNotificationRead);
notificationRoutes.put("/user/preferences", auth, updateUserPreferences);
notificationRoutes.patch("/user/profile/theme", auth, updateThemePreference);
export default notificationRoutes;
