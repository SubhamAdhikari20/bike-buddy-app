// backend/src/models/renter.model.ts
import mongoose, { Schema, Document } from "mongoose";
import type { Renter } from "./../types/renter.type.ts";

export interface IRenter extends Omit<Renter, "baseUserId">, Document {
  baseUserId: Schema.Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}

const renterSchema: Schema<IRenter> = new Schema(
  {
    baseUserId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
      minLength: [10, "Phone number must be 10 digits"],
      maxLength: [10, "Phone number must be 10 digits"],
    },
    password: {
      type: String,
      minLength: [8, "Password must be at least 8 characters"],
      default: null,
      select: false,
    },
    profilePictureUrl: {
      type: String,
      default: null,
    },
    googleId: {
      type: String,
    },
    bio: {
      type: String,
      maxLength: [500, "Bio cannot exceed 500 characters"],
      default: null,
    },
    terms: {
      type: Boolean,
      required: true,
      default: false,
    },
    idDocumentUrl: {
      type: String,
      default: null,
    },
    kycStatus: {
      type: String,
      enum: ["unverified", "pending", "approved", "rejected"],
      default: "unverified",
    },
    kycSubmittedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

renterSchema.index(
  { phoneNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { phoneNumber: { $type: "string" } },
  },
);
renterSchema.index(
  { googleId: 1 },
  {
    unique: true,
    partialFilterExpression: { googleId: { $type: "string" } },
  },
);

const RenterModel =
  (mongoose.models.renters as mongoose.Model<IRenter>) ??
  mongoose.model<IRenter>("renters", renterSchema);

export default RenterModel;
