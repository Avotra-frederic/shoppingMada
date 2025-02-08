import { FilterQuery } from "mongoose";
import IProduct from "../interface/product.interface";
import Product from "../model/product.model";
import { access } from "fs";

const create_product = async (product: IProduct): Promise<IProduct | null> => {
  try {
    const prod = await Product.create(product);
    return prod ? prod : null;
  } catch (error) {
    throw error;
  }
};

const getAllProduct = async (): Promise<IProduct | null> => {
  try {
    const products = await Product.find({}).lean<IProduct>().populate("boutiks_id");
    return products ? products : null;
  } catch (error) {
    throw error;
  }
};

const getBoutiksProduct = async (
  owner_id: string,
): Promise<IProduct | null> => {
  try {
    const product = await Product.find({ owner_id: owner_id }).lean<IProduct>();
    return product ? product : null;
  } catch (error) {
    throw error;
  }
};

const getAllProductInCategory = async (
  slug: string,
): Promise<IProduct | null> => {
  try {
    const products = await Product.find({ category: slug }).lean<IProduct>().populate("boutiks_id");
    return products ? products : null;
  } catch (error) {
    throw error;
  }
};

const addProductVariant = async (
  id: string,
  variant: any,
): Promise<IProduct | null> => {
  try {
    const product  = await Product.findById(id);
    if(!product) return null;

    const existingVariant = product.variant.find((v :any)=> v.name === variant.name);
    if(existingVariant){
      existingVariant.values.push(...variant.values);
    }else{
      product.variant.push(variant);
    }

    await product.save()
    return product.toObject();
  } catch (error) {
    throw error;
  }
};

const deleteProduct = async (id: string): Promise<IProduct | null> => {
  try {
    const product = await Product.findByIdAndDelete(id, {
      new: true,
    }).lean<IProduct>();
    return product ? product : null;
  } catch (error) {
    throw error;
  }
};

const updateProduct = async (
  id: string,
  product: IProduct,
): Promise<IProduct | null> => {
  try {
    const newProduct = await Product.findByIdAndUpdate(id, product, {
      new: true,
    }).lean<IProduct>();
    return newProduct ? newProduct : null;
  } catch (error) {
    throw error;
  }
};

const getProductById = async (id: string): Promise<IProduct | null> => {
  try {
    const product = await Product.findById(id).lean<IProduct>().populate("boutiks_id");
    return product ? product : null;
  } catch (error) {
    throw error;
  }
};

const updateVariant = async (
  id: string,
  variant_id: string,
  newVariant: any,
): Promise<IProduct | null> => {
  try {
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id, "variant._id": variant_id },
      {
        $set: {
          "variant.$.name": newVariant.name,
          "variant.$.additionalPrice": newVariant.additionalPrice,
          "variant.$.values": newVariant.values,
        },
      },
      { new: true },
    ).lean<IProduct>();

    return updatedProduct ? updatedProduct : null;
  } catch (error) {
    throw error;
  }
};

const deleteVariant = async (
  id: string,
  variant_id: string,
  valueName: string
): Promise<IProduct | null> => {
  try {
    const updatedProduct = await Product.findOneAndUpdate(
      {_id:id, "variant._id":variant_id},
      {$pull:{"variant.$.values":{value:valueName}}}
    ).lean<IProduct>();

    if(updatedProduct?.variant){
      const variant =  updatedProduct.variant.find((v:any)=>v._id.toString() === variant_id)
      if(variant && variant.values?.length === 0){
        await Product.findByIdAndUpdate(id,{$pull:{variant:{_id: variant_id}}})
      }
    }
    

    return updatedProduct ? updatedProduct : null;
  } catch (error) {
    throw error;
  }
};

const searchProduct = async(q: string, location?:string): Promise<IProduct | IProduct[] | [] > =>{
  let product = await Product.find({
    $or:[
      {name: {$regex: q, $options:"i"}},
      {description:{$regex: q, $options:"i"}},
      {details:{$regex: q, $options:"i"}},
    ]
  }).lean<IProduct[]>().populate("boutiks_id");


  if(location){
    product = product.filter(pr => pr.boutiks_id && pr.boutiks_id.ville && new RegExp(location,"i").test(pr.boutiks_id.ville))
  }
  return product.length > 0? product : [];
}

export {
  create_product,
  getAllProduct,
  getAllProductInCategory,
  getProductById,
  deleteProduct,
  updateProduct,
  updateVariant,
  deleteVariant,
  getBoutiksProduct,
  addProductVariant,
  searchProduct
};
