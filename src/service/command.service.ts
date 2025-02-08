import { Mongoose } from "mongoose";
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

const getBoutiksCommand = async(id: string): Promise<ICommand | null> => {
    try {
        const commande = await Command.find({boutiks_id: id}).lean<ICommand>().populate("product_id").populate("owner_id");
        return commande ? commande : null;
    } catch (error) {
        throw error;
    }
}

const getClientCommand = async(id: string): Promise<ICommand | null> => {
    try {
        const commande = await Command.find({owner_id: id}).lean<ICommand>().populate("product_id").populate("owner_id");
        return commande ? commande : null;
    } catch (error) {
        throw error;
    }
}

const updateStatus =  async(id: string, newStatus: string)=>{
    try {
        const commande =  await Command.findByIdAndUpdate(id,{status:newStatus},{new:true}).lean<ICommand>().populate({path:"product_id", populate:{path:"boutiks_id"}}).populate("owner_id");
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
        const command = await Command.findById(id).lean<ICommand>().populate("owner_id").populate("product_id");
        return command ? command : null
    } catch (error) {
        throw error;
    }
}
export {addCommande, deleteProductCommand, getBoutiksCommand, updateStatus, getClientCommand,deleteCommande, getCommandeById}