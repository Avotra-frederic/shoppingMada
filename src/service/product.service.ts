import { FilterQuery } from "mongoose";
import IProduct from "../interface/product.interface";
import Product from "../model/product.model";
import { getActiveBoutikIds } from "./boutiks.service";

const create_product = async (product: IProduct): Promise<IProduct | null> => {
  try {
    const prod = await Product.create(product);
    return prod ? prod : null;
  } catch (error) {
    throw error;
  }
};

const getAllProduct = async (): Promise<IProduct[] | null> => {
  try {
    const activeBoutikIds = await getActiveBoutikIds();
    const products = await Product.find({
      publicationStatus: "Approved",
      boutiks_id: { $in: activeBoutikIds },
    }).lean<IProduct[]>().populate("boutiks_id");
    return products ? products : null;
  } catch (error) {
    throw error;
  }
};

const getBoutiksProduct = async (
  owner_id: string,
): Promise<IProduct[] | null> => {
  try {
    const product = await Product.find({ owner_id: owner_id }).lean<IProduct[]>();
    return product ? product : null;
  } catch (error) {
    throw error;
  }
};

const listBoutiksProducts = async (ownerId: string, options: { page: number; limit: number; q?: string; status?: string }) => {
  const filter: Record<string, unknown> = { owner_id: ownerId };
  if (options.status && options.status !== "all") filter.publicationStatus = options.status;
  if (options.q) {
    const safe = options.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ name: { $regex: safe, $options: "i" } }, { description: { $regex: safe, $options: "i" } }];
  }
  const [data, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1, _id: -1 }).skip((options.page - 1) * options.limit).limit(options.limit).lean<IProduct[]>(),
    Product.countDocuments(filter),
  ]);
  return { data, pagination: { page: options.page, limit: options.limit, total, pages: Math.ceil(total / options.limit) } };
};

const getAllProductInCategory = async (
  slug: string,
): Promise<IProduct[] | null> => {
  try {
    const activeBoutikIds = await getActiveBoutikIds();
    const products = await Product.find({
      category: slug,
      publicationStatus: "Approved",
      boutiks_id: { $in: activeBoutikIds },
    }).lean<IProduct[]>().populate("boutiks_id");
    return products ? products : null;
  } catch (error) {
    throw error;
  }
};

const listPublicProducts = async (options: { page: number; limit: number; q?: string; location?: string; category?: string; sort?: string; minPrice?: number; maxPrice?: number }) => {
  const activeBoutikIds = await getActiveBoutikIds();
  const filter: any = { publicationStatus: "Approved", boutiks_id: { $in: activeBoutikIds } };
  if (options.category) filter.category = options.category;
  if (options.minPrice !== undefined || options.maxPrice !== undefined) {
    filter.price = {};
    if (options.minPrice !== undefined) filter.price.$gte = options.minPrice;
    if (options.maxPrice !== undefined) filter.price.$lte = options.maxPrice;
  }
  if (options.q) { const safe = options.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); filter.$or = [{ name: { $regex: safe, $options: "i" } }, { description: { $regex: safe, $options: "i" } }, { details: { $regex: safe, $options: "i" } }]; }
  if (options.location) { const safe = options.location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); const shops = await (await import("../model/boutiks.model")).default.find({ _id: { $in: activeBoutikIds }, ville: { $regex: safe, $options: "i" } }).distinct("_id"); filter.boutiks_id = { $in: shops }; }
  const sort: Record<string, 1 | -1> = options.sort === "price_asc" ? { price: 1, _id: 1 } : options.sort === "price_desc" ? { price: -1, _id: -1 } : options.sort === "oldest" ? { createdAt: 1, _id: 1 } : { createdAt: -1, _id: -1 };
  const [data, total] = await Promise.all([Product.find(filter).sort(sort).skip((options.page - 1) * options.limit).limit(options.limit).populate("boutiks_id").lean(), Product.countDocuments(filter)]);
  return { data, pagination: { page: options.page, limit: options.limit, total, pages: Math.ceil(total / options.limit) } };
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

const getProductsForModeration = async (page = 1, limit = 25) => {
  const [data, total] = await Promise.all([Product.find({})
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit).limit(limit)
    .lean<IProduct[]>()
    .populate("boutiks_id", "name logo")
    .populate("owner_id", "username email"), Product.countDocuments({})]);
  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const moderateProduct = async (
  id: string,
  publicationStatus: "Approved" | "Rejected",
  moderationReason: string,
  moderatorId: string,
): Promise<IProduct | null> =>
  Product.findByIdAndUpdate(
    id,
    {
      publicationStatus,
      moderationReason,
      moderatedBy: moderatorId,
      moderatedAt: new Date(),
    },
    { new: true, runValidators: true },
  ).lean<IProduct>();

const submitProductForReview = async (id: string): Promise<void> => {
  await Product.findByIdAndUpdate(id, {
    publicationStatus: "Pending",
    moderationReason: "",
    $unset: { moderatedBy: 1, moderatedAt: 1 },
  });
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
  if (!q?.trim()) return [];
  const safeQuery = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const activeBoutikIds = await getActiveBoutikIds();
  let product = await Product.find({
    publicationStatus: "Approved",
    boutiks_id: { $in: activeBoutikIds },
    $or:[
      {name: {$regex: safeQuery, $options:"i"}},
      {description:{$regex: safeQuery, $options:"i"}},
      {details:{$regex: safeQuery, $options:"i"}},
    ]
  }).lean<IProduct[]>().populate("boutiks_id");


  if(location){
    const safeLocation = location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    product = product.filter(pr => pr.boutiks_id && pr.boutiks_id.ville && new RegExp(safeLocation,"i").test(pr.boutiks_id.ville))
  }
  return product.length > 0? product : [];
}

export {
  create_product,
  getAllProduct,
  getAllProductInCategory,
  listPublicProducts,
  getProductById,
  deleteProduct,
  updateProduct,
  updateVariant,
  deleteVariant,
  getBoutiksProduct,
  listBoutiksProducts,
  addProductVariant,
  searchProduct,
  getProductsForModeration,
  moderateProduct,
  submitProductForReview,
};
