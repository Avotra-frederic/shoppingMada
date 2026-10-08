import connection from "./config/db";
import app from "./config/app";
import user_group_migration from "./migration/user_group.migration";
import { processExpiredMarketplaceOrders } from "./service/marketplace-order.service";
import { processSubscriptionLifecycle } from "./controller/subscription.controller";
const port = Number(process.env.PORT ?? 3000);
connection().then(async()=>{
    await user_group_migration();
    const expireOrders = () => {
        void processExpiredMarketplaceOrders().catch(() => {
            console.error("Le traitement des expirations de commandes a échoué.");
        });
    };
    expireOrders();
    const lifecycle = () => {
        void processSubscriptionLifecycle().catch(() => console.error("Le traitement du cycle des abonnements a échoué."));
    };
    lifecycle();
    const expirationInterval = setInterval(expireOrders, 60_000);
    expirationInterval.unref();
    const lifecycleInterval = setInterval(lifecycle, 60_000);
    lifecycleInterval.unref();
    app.listen(port, "127.0.0.1", ()=>{
        console.log(`Server running at http://localhost:${port}`)
    })
})



