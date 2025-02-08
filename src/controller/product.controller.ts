import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import IProduct from "../interface/product.interface";
import {
  create_product,
  getAllProductInCategory,
  getAllProduct,
  getProductById,
  addProductVariant,
  getBoutiksProduct,
  deleteProduct,
  deleteVariant,
  updateVariant,
  updateProduct,
  searchProduct,
} from "../service/product.service";
import path from "path";
import fs from "fs";
import { findBoutiks } from "../service/boutiks.service";
import { deleteProductCommand } from "../service/command.service";

const storeProduct = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const data = req.body;
    const fileNames = (req as any).fileNames;
    const boutiks = await findBoutiks((req as any).user._id);
    if (req.method === "POST") {
      const newData = {
        ...data,
        owner_id: (req as any).user._id,
        photos: fileNames,
        boutiks_id: boutiks?._id,
      };
      const product = await create_product(newData as IProduct);
      if (!product) {
        res.status(400).json({
          status: "Failed",
          message: "Failed to save product! Please try again",
        });
        return;
      }
    }

    if (req.method === "PUT") {
      const { id } = req.params;
      const { boutiks_id, variant, photos, ...extractData } = data;
      var newData = null;
      if (Array.from(fileNames).length > 0) {
        newData = { ...extractData, photos: fileNames };
      } else {
        const { photos, image, ...updateInfo } = extractData;
        newData = { ...updateInfo, photos: image };
      }
      const product = await updateProduct(id, newData as IProduct);
      if (!product) {
        res
          .status(400)
          .json({
            status: "Failed",
            message: "Failed to update product! Please try again",
          });
        return;
      }
    }

    res
      .status(201)
      .json({ status: "Success", message: "Product save successfully !" });
  },
);

const getProduct = expressAsyncHandler(async (req: Request, res: Response) => {
  const { category, id } = req.params;

  const user = (req as any).user;

  if (user && !id) {
    const product = await getBoutiksProduct(user._id);
    res.status(200).json({ status: "Success", data: product });
    return;
  }
  if (id) {
    const product = await getProductById(id);
    res.status(200).json({ status: "Success", data: product });
    return;
  }

  if (category) {
    const product = await getAllProductInCategory(category);
    res.status(200).json({ status: "Success", data: product });
    return;
  }

  const product = await getAllProduct();
  res.status(200).json({ status: "Success", data: product });
});

const addNewVariant = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      res.status(401).json({ status: "Failed", message: "Unauthorized!" });
    }
    const data = req.body;
    const variant = await addProductVariant(id, data);
    if (!variant) {
      res.status(400).json({
        status: "Failed",
        message: "An error as occured! please try again later",
      });
      return;
    }

    res.status(201).json({
      status: "Success",
      message: "Product variant is added successfully!",
    });
  },
);

const deleteBoutiksProduct = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ status: "Failed", message: "Unauthorized" });
      return;
    }
    const newProduct = await deleteProduct(id);
    if (!newProduct) {
      res.status(400).json({
        status: "Failed",
        message: "An error as occured! please try again later",
      });
      return;
    }
    newProduct.photos.forEach((photo: string, index: number) => {
      const imagePath = path.join(
        __dirname,
        "../..",
        "public",
        "uploads",
        newProduct.photos[index],
      );
      fs.unlink(imagePath, (err) => {
        if (err) {
          console.log(err);
        }
      });
    });

    await deleteProductCommand(id);

    res.status(201).json({
      status: "Success",
      message: "Product deleted successfully!",
      data: newProduct,
    });
  },
);

const removeVariant = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id, variant_id, valueName } = req.params;
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ status: "Failed", message: "Unauthorized" });
      return;
    }
    console.log(valueName)
    const product = await deleteVariant(id, variant_id, valueName);
    if (!product) {
      res.status(400).json({
        status: "Failed",
        message: "An error as occured! please try again later",
      });
      return;
    }

    res.status(201).json({
      status: "Success",
      message: "Product variant deleted successfully!",
      data: product,
    });
  },
);

const updateProductVariant = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id, variant_id } = req.params;
    const data = req.body;
    const variant = await updateVariant(id, variant_id, data);
    if (!variant) {
      res.status(400).json({
        status: "Failed",
        message: "An error as occured! please try again later",
      });
      return;
    }

    res.status(201).json({
      status: "Success",
      message: "Product variant is added successfully!",
    });
  },
);

const search_product = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { q,location } = req.query;
    try {
      let product ;
      if(!location){
        product =  await searchProduct(q as string);
      }
      if(location){
        console.log(location)
        product =  await searchProduct(q as string, location as string);
      }
      if (!product) {
        res.status(404).json({ message: "Cannot find a product!" });
        return;
      }

      res.status(200).json({ data: product });
    } catch (error) {
      throw error;
    }
  },
);

export {
  storeProduct,
  getProduct,
  addNewVariant,
  deleteBoutiksProduct,
  removeVariant,
  updateProductVariant,
  search_product,
};
