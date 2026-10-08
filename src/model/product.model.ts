import { model, models, Schema, Types } from "mongoose";
import IProduct from "../interface/product.interface";
const arrayLimit = (val: any[]): boolean => {
  return val.length <= 5;
};

const ProductScheme = new Schema<IProduct>(
  {
    wishlistedBy: { type: [Types.ObjectId], ref: "User", default: [], select: false },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    details: {
      type: String,
    },
    price: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },

    stock: {
      type: Number,
    },

    variant: [
      {
        _id: {
          type: Types.ObjectId,
          auto: true,
        },
        name: {
          type: String,
          required: true,
        },
       
        values: [
          {
            value:{
              type:String,
            },
            additionalPrice: {
              type: Number,
              default: 0.0,
            },
            stock:{
              type:Number,
              default:0
            }
          }
        ]
      },
    ],
    photos: {
      type: [String],
      validate: [arrayLimit, "upload limit is reachable!"],
    },
    owner_id: {
      type: Types.ObjectId,
      ref: "User",
    },
    boutiks_id: {
      type: Types.ObjectId,
      ref: "Boutiks",
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    publicationStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index: true,
    },
    moderationReason: { type: String, maxlength: 500 },
    moderatedBy: { type: Types.ObjectId, ref: "User" },
    moderatedAt: { type: Date },
  },
  { timestamps: true },
);

ProductScheme.index({ owner_id: 1, createdAt: -1 });
ProductScheme.index({ owner_id: 1, publicationStatus: 1, createdAt: -1 });

const Product = models.Product || model<IProduct>("Product", ProductScheme);
export default Product;
