import connection from "./config/db";
import app from "./config/app";
import user_group_migration from "./migration/user_group.migration";
const port = process.env.PORT || 3000;
connection().then(()=>{
    user_group_migration();
    app.listen(port, "127.0.0.1", ()=>{
        console.log(`Server running at http://localhost:${port}`)
    })
})



