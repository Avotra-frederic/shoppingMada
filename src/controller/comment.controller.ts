import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { addComment, deleteComment, getProductComment } from "../service/comment.service";

const addNewComment = expressAsyncHandler(async(req: Request, res: Response)=>{
    const user = (req as any).user;
    const data = req.body;
    if(!user){
        res.status(401).json({status:"Failed", message:"Authentification requise."});
        return;
    }

    try {
        const newData = {...data, owner_id: user._id};
        const comment = await addComment(newData);

        if(!comment){
            res.status(400).json({status:"Failed", message:"Impossible d’ajouter le commentaire."});
            return;
        }

        res.status(201).json({status:"Success", message:"Le commentaire a été ajouté.", data: comment});
    } catch (error) {
        throw error
    }
})


const removeComment = expressAsyncHandler(async(req: Request, res:Response)=>{
    const user = (req as any).user;
    const {id} = req.params;
    if(!user){
        res.status(401).json({status:"Failed", message:"Authentification requise."});
        return;
    }

    try {
        const comment = await deleteComment(id);
        if(!comment){
            res.status(400).json({status:"Failed", message:"Impossible de supprimer le commentaire."});
            return;
        }

        res.status(201).json({status:"Success", message:"Le commentaire a été supprimé.", data: comment});
    } catch (error) {
        throw error;
    }

   
});

const getComment = expressAsyncHandler(async(req: Request, res:Response)=>{
    const {id} = req.params;
    const comment = await getProductComment(id);
    if(!comment){
        res.status(400).json({status:"Failed", message:"Commentaire introuvable."});
        return;
    }
    res.status(200).json({status:"Success", data: comment});
})


export {getComment, removeComment, addNewComment};