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
    const freeAccessFallback = new Date(now.getTime() - 30 * 86400000);
    const Subscription = (await import("../model/abonnement.model")).default;
    const eligibleSubscriptions = await Subscription.find({
        payementStatus: "Completed",
        $or: [
            { startDate: { $lte: now }, endDate: { $gt: now } },
            { endDate: { $lte: now }, graceUntil: { $gt: now }, cancelAtPeriodEnd: { $ne: true } },
        ],
    }).distinct("owner_id");
    const shops = await Boutiks.find({
        isActive: { $ne: false },
        $or: [
            { freeAccessEndsAt: { $gt: now } },
            { freeAccessEndsAt: { $exists: false }, freeAccessStartedAt: { $gt: freeAccessFallback } },
            { freeAccessEndsAt: { $exists: false }, freeAccessStartedAt: { $exists: false }, createdAt: { $gt: freeAccessFallback } },
            { owner_id: { $in: eligibleSubscriptions } },
        ],
    }).distinct("_id");
    return shops.map((id) => String(id));
}

const isBoutikPubliclyEligible = async (shop: any): Promise<boolean> => {
    if (!shop || shop.isActive === false) return false;
    const now = new Date();
    if (shop.freeAccessEndsAt && new Date(shop.freeAccessEndsAt).getTime() > now.getTime()) return true;
    if (!shop.freeAccessEndsAt && new Date(shop.freeAccessStartedAt ?? shop.createdAt).getTime() + 30 * 86400000 > now.getTime()) return true;
    const Subscription = (await import("../model/abonnement.model")).default;
    return Boolean(await Subscription.exists({
        owner_id: shop.owner_id,
        payementStatus: "Completed",
        $or: [
            { startDate: { $lte: now }, endDate: { $gt: now } },
            { endDate: { $lte: now }, graceUntil: { $gt: now }, cancelAtPeriodEnd: { $ne: true } },
        ],
    }));
}

const getPublicBoutikIds = getActiveBoutikIds;

export {create_boutiks,delete_boutiks, updateBoutiks, findBoutiks, addNewCategorie, getActiveBoutikIds, getPublicBoutikIds, isBoutikPubliclyEligible};
