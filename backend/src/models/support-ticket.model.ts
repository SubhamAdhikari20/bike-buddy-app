// backend/src/models/support-ticket.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ISupportTicket extends Document {
    userId: Schema.Types.ObjectId | string;
    bookingId: Schema.Types.ObjectId | string | null;
    type: "breakdown" | "complaint" | "general";
    subject: string;
    message: string;
    photos: string[];
    status: "open" | "in_review" | "resolved";
    rating: number | null;
    ratingComment: string | null;
    createdAt: Date;
    updatedAt: Date;
}

const supportTicketSchema: Schema<ISupportTicket> = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "users", required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "bookings", default: null },
    type: { type: String, enum: ["breakdown", "complaint", "general"], default: "general", index: true },
    subject: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 2000 },
    photos: { type: [String], default: [] },
    status: { type: String, enum: ["open", "in_review", "resolved"], default: "open", index: true },
    rating: { type: Number, min: 1, max: 5, default: null },
    ratingComment: { type: String, maxlength: 500, default: null },
}, {
    timestamps: true,
});

const SupportTicketModel = (mongoose.models.support_tickets as mongoose.Model<ISupportTicket>) ?? mongoose.model<ISupportTicket>("support_tickets", supportTicketSchema);

export default SupportTicketModel;
