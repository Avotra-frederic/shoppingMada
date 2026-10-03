import connection from "./config/db";
import app from "./config/app";
import user_group_migration from "./migration/user_group.migration";
import { processExpiredMarketplaceOrders } from "./service/marketplace-order.service";
const port = Number(process.env.PORT ?? 3000);
connection().then(()=>{
    user_group_migration();
    const expireOrders = () => {
        void processExpiredMarketplaceOrders().catch(() => {
            console.error("Le traitement des expirations de commandes a échoué.");
        });
    };
    expireOrders();
    const expirationInterval = setInterval(expireOrders, 60_000);
    expirationInterval.unref();
    app.listen(port, "127.0.0.1", ()=>{
        console.log(`Server running at http://localhost:${port}`)
    })
})



