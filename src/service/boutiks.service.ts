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

const updateBoutiks= async(id: string, data: Partial<IBoutiks>): Promise<IBoutiks | null> => {
    try {
        const updateQuery = (data as any).$push
      ? { $push: (data as any).$push }
      : data;
      
        const boutiks = await Boutiks.findByIdAndUpdate(id, updateQuery, {new: true});
        return boutiks ? boutiks : null;
    }catch(error){
        throw error
    }
}

const addNewCategorie = async(id: string, idcategorie:string):Promise<IBoutiks | null> =>{
    const boutiks = await Boutiks.findByIdAndUpdate(id,{$addToSet:{product_category:idcategorie}});
    return boutiks ? boutiks : null;
}

const findBoutiks = async(owner_id: string): Promise<IBoutiks | null> =>{
    const boutiks = await Boutiks.findOne({owner_id: owner_id}).lean<IBoutiks>().populate("subscription_id");
    return boutiks || null;
}

const getActiveBoutikIds = async (): Promise<string[]> => {
    const now = new Date();
    const Subscription = (await import("../model/abonnement.model")).default;
    const activeSubscriptions = await Subscription.find({ payementStatus: "Completed", startDate: { $lte: now }, endDate: { $gt: now } }).select("owner_id").lean<any[]>();
    const graceSubscriptions = await Subscription.find({ payementStatus: "Completed", endDate: { $lte: now }, graceUntil: { $gt: now } }).select("owner_id").lean<any[]>();
    const paidOwnerIds = [...activeSubscriptions, ...graceSubscriptions].map((subscription) => subscription.owner_id).filter(Boolean);
    const ids = await Boutiks.find({
        isActive: { $ne: false },
        $or: [
            { freeAccessEndsAt: { $gt: now } },
            { freeAccessEndsAt: { $exists: false }, freeAccessStartedAt: { $gt: new Date(now.getTime() - 30 * 86400000) } },
            { freeAccessEndsAt: { $exists: false }, freeAccessStartedAt: { $exists: false }, createdAt: { $gt: new Date(now.getTime() - 30 * 86400000) } },
            { owner_id: { $in: paidOwnerIds } },
        ],
    }).distinct("_id");
    return ids.map((id) => String(id));
}

export {create_boutiks,delete_boutiks, updateBoutiks, findBoutiks, addNewCategorie, getActiveBoutikIds};
