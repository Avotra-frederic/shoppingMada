import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import {
  createNewSubscription,
  findSubscription,
  getBoutiksSubscription,
  getSubscription,
  updateSubscription,
} from "../service/subscription.service";
import { updateBoutiks } from "../service/boutiks.service";
import IUser from "../interface/user.interface";
import { Types } from "mongoose";
import IBoutiks from "../interface/boutiks.interface";
import sendEmail from "../helpers/mail";
import ISubscription from "../interface/abonnement.interface";

const sendNewSubscription = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ status: "Failed", message: "Access denied" });
      return;
    }

    if (!user.boutiks_id) {
      res.status(401).json({ status: "Failed", message: "Access denied" });
      return;
    }

    const data = req.body;

    const newData = { ...data, owner_id: user._id };

    const subscription = await createNewSubscription(newData);

    if (!subscription) {
      res
        .status(403)
        .json({ status: "Failed", message: "An error is occured" });
      return;
    }


    res.status(201).json({
      status: "Success",
      message: "Your request is sent successfully!",
    });
  },
);

const updateNewSubscription = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { id } = req.params;
    if (!user) {
      res.status(401).json({ status: "Failed", message: "Access denied" });
      return;
    }

    const data = req.body;

    const subscription = await updateSubscription(data, id);
    if (subscription && data.payementStatus === "Completed") {
      const boutiks = await updateBoutiks(
        (subscription.owner_id as IUser).boutiks_id as string,
        {
          subscription_id: new Types.ObjectId(subscription._id as string),
          plan: "pro",
        } as IBoutiks,
      );
      if (!boutiks) {
        res
          .status(403)
          .json({ status: "Failed", message: "An error is occured" });
        return;
      }
    }

    if (!subscription) {
      res
        .status(403)
        .json({ status: "Failed", message: "An error is occured" });
      return;
    }
    if (data.motif) {
      const email = {
        title: "Information",
        message: `Bonjour, je vous tient informer que votre demande d'abonnement a  été réfuser on raison de: `,
        information:data.motif,
        content:
          "Merci de votre comprehension, si vous aurez besoin plus d'information merci de contacter l'adminitrateur de notre plateforme",
      };
      await sendEmail(email, (subscription as any).owner_id.email as string,"Demande d'abonnement")
    }

    if(data.status === "Completed"){
      const email = {
        title: "Information",
        message: `Bonjour, je vous tient informer que votre demande d'abonnement du ${new Date((subscription as any).createdAt).toLocaleDateString("fr-FR")} a  été accépté: `,
        information:"Abonnement validé!",
        content:
          "Merci de votre confiance, si vous aurez besoin plus d'information merci de contacter l'adminitrateur de notre plateforme",
      };
      await sendEmail(email, (subscription as any).owner_id.email as string,"Demande d'abonnement")
    }

    res
      .status(201)
      .json({ status: "Success", message: "Subscription status is updated!" });
  },
);
const getSubscriptionList = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { id } = req.params;
    if (!user) {
      res.status(401).json({ status: "Failed", message: "Access denied" });
      return;
    }
    let subscription;

    if (user.boutiks_id && !id) {
      subscription = await getBoutiksSubscription(user._id);
      res.status(201).json({ status: "Success", data: subscription });
      return;
    }

    if (!user.boutiks_id && !id) {
      subscription = await getSubscription();
      res.status(201).json({ status: "Success", data: subscription });
      return;
    }

    if (id) {
      subscription = await findSubscription(id);
      res.status(201).json({ status: "Success", data: subscription });
      return;
    }

    res.status(201).json({ status: "Success", data: subscription });
  },
);

export { sendNewSubscription, updateNewSubscription, getSubscriptionList };
