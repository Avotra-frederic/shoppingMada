import ISubscription from "../interface/abonnement.interface";
import Subscription from "../model/abonnement.model";

const createNewSubscription = async(data : ISubscription) : Promise<ISubscription | null> =>{
    try {
        const subscription = await Subscription.create(data);
        return subscription ? subscription : null;
    } catch (error) {
        throw error
    }
}


const updateSubscription = async(newData : ISubscription, id: string) : Promise<ISubscription | null> =>{
    try {
        const subscription = await Subscription.findByIdAndUpdate(id, newData, {new:true}).lean<ISubscription>().populate("owner_id");
        return subscription ? subscription : null
    } catch (error) {
        throw error;
    }
}

const getSubscription = async ():Promise<ISubscription[] | null> =>{
    try {
        const subscription = await Subscription.find().lean<ISubscription[]>().populate({path:"owner_id",populate:{path:"boutiks_id"}});
        return subscription ? subscription : null;
    } catch (error) {
        throw error;
    }
}
const getBoutiksSubscription = async (id:string):Promise<ISubscription[] | null> =>{
    try {
        const subscription = await Subscription.find({owner_id:id}).lean<ISubscription[]>().populate({path:"owner_id",populate:{path:"boutiks_id"}})
        return subscription ? subscription : null;
    } catch (error) {
        throw error;
    }
}

const findSubscription = async (id:string):Promise<ISubscription| null> =>{
    try {
        const subscription = await Subscription.findById(id).lean<ISubscription>().populate({path:"owner_id",populate:{path:"boutiks_id"}});
        return subscription ? subscription : null;
    } catch (error) {
        throw error;
    }
}




export {createNewSubscription,updateSubscription, getSubscription,getBoutiksSubscription, findSubscription};