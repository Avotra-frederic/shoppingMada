import { Document, Types } from "mongoose";

export default interface IBoutiks extends Document
{
    _id: Types.ObjectId;
    name:string,
    phoneNumber: string,
    whatsappNumber?: string;
    email: string,
    owner_id: Types.ObjectId | string,
    logo: string,
    product_category?: [Types.ObjectId | string];
    adresse:String;
    issuer?:string;
    plan:string;
    ville:string;
    subscription_id:Types.ObjectId
    description?: string;
    websiteUrl?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    tiktokUrl?: string;
    youtubeUrl?: string;
    isActive?: boolean;
}
