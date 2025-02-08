import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { get_user_group_name } from "../service/user_group_member.service";
import { findBoutiks } from "../service/boutiks.service";
import {
  addCommande,
  deleteCommande,
  getBoutiksCommand,
  getClientCommand,
  getCommandeById,
  updateStatus,
} from "../service/command.service";
import ICommand from "../interface/command.interface";
import { getProductById } from "../service/product.service";
import sendEmail from "../helpers/mail";

const getAllCommand = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { id } = req.params;
    if (!user) {
      res.status(401).json({ status: "Failed", message: "Unauthorized!" });
      return;
    }

    if (id) {
      const command = await getCommandeById(id);
      if (!command) {
        res
          .status(404)
          .json({ status: "Failed", message: "Commande introvable!" });
        return;
      }

      res.status(200).json({ status: "success", data: command });
      return;
    }

    const usergroupname = await get_user_group_name({ user_id: user._id });
    if (!usergroupname) {
      res
        .status(400)
        .json({ status: "Failed", message: "Cannot find user group name" });
      return;
    }

    switch (usergroupname) {
      case "Boutiks":
        const boutiks = await findBoutiks(user._id);
        if (!boutiks) {
          res
            .status(400)
            .json({ status: "Failed", message: "Cannot find boutiks" });
          break;
        }

        const command = await getBoutiksCommand(
          boutiks?._id as unknown as string,
        );
        if (!command) {
          res
            .status(400)
            .json({ status: "Failed", message: "Cannot find command" });
          break;
        }

        res.status(200).json({ status: "Success", data: command });
        break;
      case "Client":
        const commandClient = await getClientCommand(user._id);
        if (!commandClient) {
          res
            .status(400)
            .json({ status: "Failed", message: "Cannot find command" });
          break;
        }
        res.status(200).json({ status: "Success", data: commandClient });
        break;

      default:
        break;
    }
  },
);

const addNewCommande = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const data = req.body;
    console.log(data);
    if (!user) {
      res.status(401).json({ status: "Failed", message: "Unauthorized!" });
      return;
    }

    const product = await getProductById(data.product_id);
    if (!product) {
      res
        .status(400)
        .json({ status: "Failed", message: "Cannot find product" });
      return;
    }

    const newData = {
      ...data,
      owner_id: user._id,
      boutiks_id: product.boutiks_id._id,
    };

    const newCommande = await addCommande(newData as ICommand);
    if (!newCommande) {
      res
        .status(400)
        .json({ status: "Failed", message: "Cannot add commande" });
      return;
    }
    const email = {
      title: "Information",
      message: `Bonjour, Vous avez reçu une nouveau commande de la part de: `,
      information:user.email,
      content:
        "Vous pouvez le voir dans la liste de commande de votre espace vendeur chez Shoppingmada. Merci de votre confiance",
    };
    await sendEmail(email, product.boutiks_id.email,"Nouveau commande")
    res.status(201).json({
      status: "Success",
      message: "Commande added successfully!",
      data: newCommande,
    });
  },
);

const updateCommande = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, motif } = req.body;
    console.log(status);
    const commande = await updateStatus(id, status);
    if (!commande) {
      res
        .status(400)
        .json({ status: "Failed", message: "Cannot update commande" });
      return;
    }

    if(motif){
      const email = {
        title: "Information",
        message: `Bonjour, je vous tient informer que votre commande de ${(commande as any).product_id.name} chez ${(commande as any).product_id.boutiks_id.name} a été rejeter on raison de: `,
        information:motif,
        content:
          "Merci de votre comprehension, si vous aurez besoin plus d'information merci de contacter l'adminitrateur de notre plateforme",
      };
      await sendEmail(email, (commande as any).owner_id.email,"Commande dans une boutique de ShoppingMada")
    }

    if(status === "Accepted"){
      const email = {
        title: "Information",
        message: `Bonjour, je vous tient informer que votre achat de ${(commande as any).product_id.name} chez ${(commande as any).product_id.boutiks_id.name} a été validé `,
        information:"Achat accépté!",
        content:
          `Merci de votre confiance, pour plus d'information vous pouvez contacter ${(commande as any).product_id.boutiks_id.name} via ${(commande as any).product_id.boutiks_id.email}`,
      };
      await sendEmail(email, (commande as any).owner_id.email,"Commande dans une boutique de ShoppingMada")
    }
    
    res.status(201).json({
      status: "Success",
      message: "Commande updated successfully!",
      data: commande,
    });
  },
);

const removeCommand = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const commande = await deleteCommande(id);
    if (!commande) {
      res
        .status(400)
        .json({ status: "Failed", message: "Cannot delete commande" });
      return;
    }
    res.status(201).json({
      status: "Success",
      message: "Commande deleted successfully!",
      data: commande,
    });
  },
);

export { getAllCommand, addNewCommande, updateCommande, removeCommand };
