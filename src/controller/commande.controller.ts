import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { get_user_group_name } from "../service/user_group_member.service";
import { findBoutiks } from "../service/boutiks.service";
import { addCommande, deleteCommande, getBoutiksCommand, getClientCommand, updateStatus } from "../service/command.service";
import ICommand from "../interface/command.interface";
import { getProductById } from "../service/product.service";

const getAllCommand  = expressAsyncHandler(async(req: Request, res: Response)=>{
    const user = (req as any).user;
    if(!user){
        res.status(401).json({status:"Failed", message:"Unauthorized!"});
        return;
    }

    const usergroupname = await get_user_group_name(user._id);
    if(!usergroupname){
        res.status(400).json({status:"Failed", message:"Cannot find user group name"});
        return;
    }

    switch (usergroupname) {
        case "Boutiks":
            const boutiks = await findBoutiks(user._id);
            if(!boutiks)
                res.status(400).json({status:"Failed", message:"Cannot find boutiks"});
            
            const command = await getBoutiksCommand(boutiks?._id as unknown as string);
            if(!command)
                res.status(400).json({status:"Failed", message:"Cannot find command"});

            res.status(200).json({status:"Success", data: command});
            break;
        case "Client":
            const commandClient = await getClientCommand(user._id);
            if(!commandClient)
                res.status(400).json({status:"Failed", message:"Cannot find command"});
            res.status(200).json({status:"Success", data: commandClient});
            break;
    
        default:
            break;
    }
})

const addNewCommande = expressAsyncHandler(async(req: Request, res: Response)=>{
    const user = (req as any).user;
    const data = req.body;
    console.log(data);
    if(!user){
        res.status(401).json({status:"Failed", message:"Unauthorized!"});
        return;
    }

    const product = await getProductById(data.product_id);
    if(!product){
        res.status(400).json({status:"Failed", message:"Cannot find product"});
        return;
    }

    const newData = {...data, owner_id: user._id,boutiks_id: product.boutiks_id._id};

    const newCommande = await addCommande(newData as ICommand);
    if(!newCommande){
        res.status(400).json({status:"Failed", message:"Cannot add commande"});
        return;
    }
    res.status(201).json({status:"Success", message:"Commande added successfully!", data: newCommande});

})

const updateCommande = expressAsyncHandler(async(req: Request, res: Response)=>{
    const {id} = req.params;
    const {status} = req.body;
    const commande = await updateStatus(id, status);
    if(!commande){
        res.status(400).json({status:"Failed", message:"Cannot update commande"});
        return;
    }
    res.status(201).json({status:"Success", message:"Commande updated successfully!", data: commande});
})

const removeCommand = expressAsyncHandler(async(req: Request, res: Response)=>{
    const {id} = req.params;
    const commande = await deleteCommande(id);
    if(!commande){
        res.status(400).json({status:"Failed", message:"Cannot delete commande"});
        return;
    }
    res.status(201).json({status:"Success", message:"Commande deleted successfully!", data: commande});
})

export {getAllCommand, addNewCommande, updateCommande, removeCommand};