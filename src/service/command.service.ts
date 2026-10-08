import ICommand from "../interface/command.interface";
import Command from "../model/command.model";

const addCommande = async(data:ICommand): Promise<ICommand | null> => {
        try{
            const commande = await Command.create(data);
            return commande ? commande : null;
        }catch(error){
            throw error;
        }
}

const getBoutiksCommand = async(id: string): Promise<ICommand[] | null> => {
    try {
        const commande = await Command.find({boutiks_id: id}).lean<ICommand[]>().populate({path:"product_id",populate:{path:"boutiks_id"}}).populate("owner_id");
        return commande ? commande : null;
    } catch (error) {
        throw error;
    }
}

const listBoutiksCommand = async (id: string, options: { page: number; limit: number; status?: string }) => {
    const filter: Record<string, unknown> = { boutiks_id: id };
    if (options.status && options.status !== "all") filter.status = options.status;
    const [data, total] = await Promise.all([
        Command.find(filter).sort({ createdAt: -1, _id: -1 }).skip((options.page - 1) * options.limit).limit(options.limit).lean<ICommand[]>().populate({path:"product_id",populate:{path:"boutiks_id"}}).populate("owner_id"),
        Command.countDocuments(filter),
    ]);
    return { data, pagination: { page: options.page, limit: options.limit, total, pages: Math.ceil(total / options.limit) } };
}

const getClientCommand = async(id: string): Promise<ICommand[] | null> => {
    try {
        const commande = await Command.find({owner_id: id}).lean<ICommand[]>().populate({path:"product_id",populate:{path:"boutiks_id"}}).populate("owner_id");
        return commande ? commande : null;
    } catch (error) {
        throw error;
    }
}

const updateStatus =  async(id: string, newStatus: string)=>{
    try {
        const commande =  await Command.findOneAndUpdate({_id: id, status: "Pending"},{status:newStatus},{new:true,runValidators:true}).lean<ICommand>().populate({path:"product_id", populate:{path:"boutiks_id"}}).populate("owner_id");
        return commande ? commande : null;
    } catch (error) {
        throw error;
    }
}

const deleteCommande = async(id: string)=>{
    try {
        const commande =  await Command.findByIdAndDelete(id).lean<ICommand>().populate("product_id").populate("owner_id");
        return commande ? commande : null;
    } catch (error) {
        throw error;
    }
}

const deleteProductCommand = async(id:string)=>{
    const command = await Command.deleteMany({product_id:id});
    return command ? command : null
}


const getCommandeById = async(id:string): Promise<ICommand | null> =>{
    try {
        const command = await Command.findById(id).lean<ICommand>().populate("owner_id").populate({path:"product_id",populate:{path:"boutiks_id"}});
        return command ? command : null
    } catch (error) {
        throw error;
    }
}
export {addCommande, deleteProductCommand, getBoutiksCommand, listBoutiksCommand, updateStatus, getClientCommand,deleteCommande, getCommandeById}
