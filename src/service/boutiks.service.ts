import IBoutiks from "../interface/boutiks.interface";
import Boutiks from "../model/boutiks.model";

const create_boutiks = async(data: IBoutiks): Promise<IBoutiks | null> =>{
    try {
        const newBoutiks = await Boutiks.create(data);
        return newBoutiks ? newBoutiks : null;
    } catch (error) {
        throw error;
    }
}

export {create_boutiks};
