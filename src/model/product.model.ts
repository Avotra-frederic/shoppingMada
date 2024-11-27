import { model, models, Schema, Types } from "mongoose";
import IProduct from "../interface/product.interface";
const arrayLimit = (val: any[]) : boolean=>{
    return val.length <= 5
}

const ProductScheme = new Schema<IProduct>({
    name: {
        type: String,
        required: true,
    },
    description:{
        type: String,
        required: true
    },
    details:{
        type: String,
    },
    price:{
        type: Number,
        required: true,
    },
    category:{
        type: String,
        required: true
    },

    stock:{
        type: Number,
    },

    variant:[
        {
            _id: {
                type: Types.ObjectId,
                auto: true,
            },
            name:{
                type: String,
                required: true
            },
            additionalPrice:{
                type: Number,
                default: 0.0
            },
            color:{
                type: String,
            }
        }
    ],
    photos:{
        type:[String],
        validate:[arrayLimit,"upload limit is reachable!"]

    }


})

const Product = models.PersonnalInfo || model<IProduct>("Product", ProductScheme);
export default Product;


