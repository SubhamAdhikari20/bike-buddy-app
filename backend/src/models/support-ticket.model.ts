// backend/src/models/support-ticket.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ISupportTicket extends Document {
    userId: Schema.Types.ObjectId | string;
    bookingId: Schema.Types.ObjectId | string | null;
    type: "breakdown" | "complaint" | "general";
    priority: "high" | "normal";
    subject: string;
    message: string;
    photos: string[];
    status: "open" | "in_review" | "resolved";
    rating: number | null;
    ratingComment: string | null;
    resolvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const supportTicketSchema: Schema<ISupportTicket> = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "users", required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "bookings", default: null },
    type: { type: String, enum: ["breakdown", "complaint", "general"], default: "general", index: true },
    priority: { type: String, enum: ["high", "normal"], default: "normal", index: true },
    subject: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    message: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    photos: {
      type: [String],
      default: [],
      validate: [(photos: string[]) => photos.length <= 3, "At most three photos are allowed"],
    },
    status: { type: String, enum: ["open", "in_review", "resolved"], default: "open", index: true },
    rating: { type: Number, min: 1, max: 5, default: null },
    ratingComment: { type: String, maxlength: 500, default: null },
    resolvedAt: { type: Date, default: null },
}, {
    timestamps: true,
});

const SupportTicketModel = (mongoose.models.support_tickets as mongoose.Model<ISupportTicket>) ?? mongoose.model<ISupportTicket>("support_tickets", supportTicketSchema);

export default SupportTicketModel;
