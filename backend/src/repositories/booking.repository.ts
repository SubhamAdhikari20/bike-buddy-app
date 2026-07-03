import BookingModel from "../models/booking.model.ts";

export const bookingRepository = {
    create: (payload: Record<string, unknown>) => BookingModel.create(payload),
    findById: (bookingId: string) => BookingModel.findById(bookingId).populate("bikeId").populate("renterId").populate("ownerId"),
    updateById: (bookingId: string, payload: Record<string, unknown>) => BookingModel.findByIdAndUpdate(bookingId, payload, { new: true }),
    deleteById: (bookingId: string) => BookingModel.findByIdAndDelete(bookingId),
    count: (filter: Record<string, unknown>) => BookingModel.countDocuments(filter),
    list: (filter: Record<string, unknown>, sort: Record<string, 1 | -1>, skip: number, limit: number) => {
        return BookingModel.find(filter).sort(sort).skip(skip).limit(limit).populate("bikeId").populate("renterId").populate("ownerId");
    },
    findOverlap: (bikeId: string, startDate: Date, endDate: Date) => {
        return BookingModel.findOne({
            bikeId,
            status: { $in: ["pending", "confirmed"] },
            $or: [
                { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
            ],
        });
    },
    findOverlappingBikeIds: (startDate: Date, endDate: Date) => {
        return BookingModel.distinct("bikeId", {
            status: { $in: ["pending", "confirmed"] },
            $or: [
                { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
            ],
        });
    },
    findByBikeAndUser: (bikeId: string, renterId: string) => BookingModel.find({ bikeId, renterId }).sort({ createdAt: -1 }),
    countActiveByBikeId: (bikeId: string) => BookingModel.countDocuments({ bikeId, status: { $in: ["pending", "confirmed"] } }),
    findByBikeId: (bikeId: string) => BookingModel.find({ bikeId }).sort({ createdAt: -1 }),
};
