import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import IBoutiks from "../interface/boutiks.interface";
import {
  addNewCategorie,
  create_boutiks,
  delete_boutiks,
  findBoutiks,
  updateBoutiks,
} from "../service/boutiks.service";
import { findUserGroupId } from "../service/user_group.service";
import { change_user_group } from "../service/user_group_member.service";
import { Types } from "mongoose";
import { updateUser } from "../service/user.service";
import IUser from "../interface/user.interface";

const storeBoutiksInfo = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const data: IBoutiks = req.body;
    const ownerId = (req as any).user._id;
    if (await findBoutiks(ownerId)) {
      res.status(409).json({ status: "Failed", message: "Une boutique existe déjà pour ce compte." });
      return;
    }
    Object.assign(data, { owner_id: ownerId });
    if ((req as any).fileName) {
      data.logo = (req as any).fileName;
    } else {
      res.status(400).json({ status: "Failed", message: "Le logo de la boutique est obligatoire." });
      return;
    }

    const createBoutiks = await create_boutiks(data);
    if (!createBoutiks) {
      res.status(401).json({
        status: "Failed",
        message: "Impossible de créer la boutique. Veuillez réessayer.",
      });
      return;
    }

    const updated_user = await updateUser((req as any).user._id, {
      boutiks_id: createBoutiks._id,
    } as IUser);
    if (!updated_user) {
      res
        .status(500)
        .json({ message: "Impossible de mettre à jour le compte. Veuillez réessayer." });
      return;
    }
    const userGroup = await findUserGroupId("Boutiks");
    if (!userGroup) {
      res.status(400).json({
        status: "Failed",
        message: "Le groupe utilisateur est introuvable. Veuillez réessayer.",
      });
      return;
    }
    const updateUsers = await change_user_group({
      user_id: (req as any).user._id,
      newusergroup_id: userGroup?._id as Types.ObjectId,
    });
    if (!updateUsers) {
      await delete_boutiks(createBoutiks?._id as unknown as string);
      res.status(402).json({
        status: "Failed",
        message: "Impossible de mettre à jour le groupe utilisateur. Veuillez réessayer.",
      });
      return;
    }
    res
      .status(201)
      .json({ status: "Success", message: "La boutique a été créée." });
  },
);

const getBoutiksInfo = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ status: "Failed", message: "Authentification requise." });
      return;
    }

    const boutiks = await findBoutiks(user._id);
    if (!boutiks) {
      res
        .status(400)
        .json({ status: "Failed", message: "Aucune boutique n’a été trouvée." });
      return;
    }

    res.status(200).json({ status: "Success", boutiks });
  },
);

const deleteBoutiks = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ status: "Failed", message: "Authentification requise." });
      return;
    }
    const boutiks = await findBoutiks(user._id);
    if (!boutiks) {
      res.status(404).json({ status: "Failed", message: "Boutique introuvable" });
      return;
    }

    await delete_boutiks(boutiks?._id as unknown as string);

    res
      .status(200)
      .json({ status: "Success", message: "La boutique a été supprimée." });
  },
);

const updateBoutiksInfo = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ status: "Failed", message: "Authentification requise." });
      return;
    }
    const boutiks = await findBoutiks(user._id);
    const input = req.body as Record<string, unknown>;
    const logo = (req as any).fileName;
    if (!boutiks) {
      res.status(404).json({ status: "Failed", message: "Boutique introuvable" });
      return;
    }
    const editableFields = [
      "name",
      "adresse",
      "phoneNumber",
      "email",
      "ville",
      "description",
      "websiteUrl",
      "facebookUrl",
      "instagramUrl",
      "tiktokUrl",
      "youtubeUrl",
    ];
    const updates: Record<string, string> = {};
    for (const field of editableFields) {
      const value = input[field];
      if (value === undefined) continue;
      if (typeof value !== "string") {
        res.status(400).json({ status: "Failed", message: "Une information de boutique est invalide." });
        return;
      }
      updates[field] = value.trim();
    }

    for (const field of ["websiteUrl", "facebookUrl", "instagramUrl", "tiktokUrl", "youtubeUrl"]) {
      const value = updates[field];
      if (!value) continue;
      try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
        updates[field] = url.toString();
      } catch {
        res.status(400).json({
          status: "Failed",
          message: "Les liens de la boutique doivent commencer par https:// ou http://.",
        });
        return;
      }
    }

    if (logo) updates.logo = logo;
    const updatedBoutiks = await updateBoutiks(
      String(boutiks._id),
      updates as Partial<IBoutiks>,
    );
    if (!updatedBoutiks) {
      res.status(500).json({ status: "Failed", message: "Impossible de mettre à jour la boutique." });
      return;
    }
    res.status(200).json({
      status: "Success",
      message: "La boutique a été mise à jour.",
    });
  },
);

const addNewCategorieINBoutiks = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { category_id } = req.body;
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ status: "Failed", message: "Authentification requise." });
      return;
    }
    const boutiks = await findBoutiks(user._id);
    if (!boutiks) {
      res.status(404).json({ status: "Failed", message: "Boutique introuvable" });
      return;
    }
    if (typeof category_id !== "string" || !category_id.trim()) {
      res.status(400).json({ status: "Failed", message: "Catégorie invalide." });
      return;
    }
    const newBoutiksInfo = await addNewCategorie(
      boutiks._id as unknown as string,
      category_id,
    );
    if (!newBoutiksInfo) {
      res.status(400).json({ status: "Success", message: "Impossible de mettre à jour la boutique." });
      return;
    }

    res.status(200).json({
      status: "Success",
      message: "La boutique a été mise à jour.",
    });
  },
);

export { storeBoutiksInfo, getBoutiksInfo, deleteBoutiks, updateBoutiksInfo,addNewCategorieINBoutiks };
