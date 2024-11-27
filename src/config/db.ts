import mongoose from "mongoose";

const connection = async () => {
  try {
    const dbURI =
        process.env.DB_URI || "mongodb://localhost:27017/shoppingMada";
        await mongoose.connect(dbURI);
  } catch (error: any) {
    throw new Error(error.message)
  }
};
export default connection;
