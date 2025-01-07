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

const delete_boutiks = async(id: string): Promise<IBoutiks | null> => {
    try {
        const boutiks = await Boutiks.findByIdAndDelete(id);
        return boutiks ? boutiks : null;
    } catch (error) {
        throw error;
    }
}

const updateBoutiks= async(id: string, data: IBoutiks): Promise<IBoutiks | null> => {
    try {
        const boutiks = await Boutiks.findByIdAndUpdate(id, data, {new: true});
        return boutiks ? boutiks : null;
    }catch(error){
        throw error
    }
}

const findBoutiks = async(owner_id: string): Promise<IBoutiks | null> =>{
    const boutiks = await Boutiks.findOne({owner_id: owner_id}).lean<IBoutiks>().exec();
    return boutiks || null;
}
export {create_boutiks,delete_boutiks, updateBoutiks, findBoutiks};
