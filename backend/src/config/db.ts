// src/config/db.ts
import mongoose from "mongoose";
import { MONGODB_URI } from "./index.ts";

type ConnectionObject = {
    isConnected?: number;
}

const connection: ConnectionObject = {};

const connectDB = async (): Promise<void> => {
    if (connection.isConnected) {
        console.log("Database is already connected.");
        return;
    }

    try {
        const mongodbUri = MONGODB_URI;
        if (!mongodbUri) {
            console.error("Missing MONGODB_URI. Please add it to config/config.env or your environment variables.".red.bold);
            process.exit(1);
        }
        const dbConnect = await mongoose.connect(mongodbUri, {});
        connection.isConnected = dbConnect.connections[0]!.readyState;
        console.log(`Connected to MongoDB server......${dbConnect.connection.host}`.yellow.underline.bold);
    }
    catch (error) {
        console.log(`MongoDB connection error: ${error}`.red.underline.bold);
        process.exit(1);
    }
};

export default connectDB;