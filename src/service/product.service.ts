import IProduct from "../interface/product.interface";
import Product from "../model/product.model"

const create_product = async(product : IProduct): Promise<IProduct | null> => {
   try {
    const prod = await Product.create(product)
    return prod ? prod : null;
   } catch (error) {
    throw error;
   }
}

const getAllProduct = async(): Promise<IProduct| null> =>{
    try {
        const products = await Product.find({}).lean<IProduct>();
        return products ? products : null;
    }
    catch (error) {
        throw error;
    }
}

const getBoutiksProduct =  async(owner_id: string): Promise<IProduct | null> =>{
    try {
        const product = await Product.find({owner_id: owner_id}).lean<IProduct>();
        return product ? product : null;
    } catch (error) {
        throw error
    }
}

const getAllProductInCategory = async(slug: string): Promise<IProduct | null> => {
    try {
            const products = await Product.find({category: slug}).lean<IProduct>();
            return products ? products : null;
    } catch (error) {
        throw error
    }
}

const addProductVariant = async(id: string, variant: any): Promise<IProduct | null> => {
    try {
        const variants = await Product.findByIdAndUpdate(id, { $push:{variant}},{new: true}).lean<IProduct>();
        return variants ? variants : null;
    } catch (error) {
        throw error
    }
}

const deleteProduct = async(id: string): Promise<IProduct | null> =>{
    try {
        const product = await Product.findByIdAndDelete(id,{new: true}).lean<IProduct>();
        return product ? product : null;
    } catch (error) {
        throw error;
    }
}

const updateProduct = async(id: string, product: IProduct): Promise<IProduct | null> => {
    try {
        const newProduct = await Product.findByIdAndUpdate(id, product, {new: true}).lean<IProduct>();
        return newProduct ? newProduct : null;
    } catch (error) {
        throw error;
    }
}

const getProductById = async(id: string): Promise<IProduct| null> => {
    try {
        const product = await Product.findById(id).lean<IProduct>();
        return product ? product : null;
    } catch (error) {
        throw error;
    }
}
   
const updateVariant = async(id:string, variant_id: string, newVariant: any): Promise<IProduct| null>=>{
    try {
        const updatedProduct = await Product.findOneAndUpdate(
            { _id: id, "variant._id": variant_id },
            {
                $set: {
                    "variant.$.name": newVariant.name,
                    "variant.$.additionalPrice": newVariant.additionalPrice,
                    "variant.$.color": newVariant.color,
                },
            },
            { new: true }
        ).lean<IProduct>();

        return updatedProduct ? updatedProduct : null;
    } catch (error) {
        throw error;
    }
}

const deleteVariant = async(id:string, variant_id:string): Promise<IProduct| null> => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            {
                $pull: { variant: { _id: variant_id } },
            },
            { new: true }
        );

        return updatedProduct ? updatedProduct : null;
    } catch (error) {
        throw error;
    }
}

export {create_product, getAllProduct, getAllProductInCategory,getProductById,deleteProduct,updateProduct,updateVariant,deleteVariant,getBoutiksProduct,addProductVariant}
