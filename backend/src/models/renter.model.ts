// backend/src/models/renter.model.ts
import mongoose, { Schema, Document } from "mongoose";
import type { Renter } from "./../types/renter.type.ts";


export interface IRenter extends Omit<Renter, "baseUserId">, Document {
    baseUserId: Schema.Types.ObjectId | string,
    createdAt: Date;
    updatedAt: Date;
}

const renterSchema: Schema<IRenter> = new Schema({
    baseUserId: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
        unique: true
    },
    fullName: {
        type: String,
        required: [true, "Full name is required"],
        trim: true
    },
    phoneNumber: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        minLength: [10, "Phone number must be 10 digits"],
        maxLength: [10, "Phone number must be 10 digits"],
        // default: null
    },
    password: {
        type: String,
        minLength: [8, "Password must be at least 8 characters"],
        default: null
    },
    profilePictureUrl: {
        type: String,
        default: null
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true,
        // default: null
    },
    bio: {
        type: String,
        maxLength: [500, "Bio cannot exceed 500 characters"],
        default: null
    },
    terms: {
        type: Boolean,
        required: true,
        default: false
    },
},
    {
        timestamps: true
    }
);


const RenterModel = (mongoose.models.renters as mongoose.Model<IRenter>) ?? (mongoose.model<IRenter>("renters", renterSchema));

export default RenterModel;