import IUserGroup from "../interface/user_group.interface";
import UserGroup from "../model/userGroup.model"
import { createUserGroup } from "../service/user_group.service";

const user_group_migration = async()=>{
    const count = await UserGroup.countDocuments();
    if(count === 0){
            const data = ["Super Admin", "Boutiks", "Client"];
            for (const element of data) {
                await createUserGroup({name: element} as IUserGroup);
            }
    }
}

export default user_group_migration;
