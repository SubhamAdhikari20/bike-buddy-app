import BikeModel from "../models/bike.model.ts";

export const bikeRepository = {
    create: (payload: Record<string, unknown>) => BikeModel.create(payload),
    findById: (bikeId: string) => BikeModel.findById(bikeId).populate("ownerId"),
    updateById: (bikeId: string, payload: Record<string, unknown>) => BikeModel.findByIdAndUpdate(bikeId, payload, { new: true }),
    deleteById: (bikeId: string) => BikeModel.findByIdAndDelete(bikeId),
    list: (filter: Record<string, unknown>, sort: Record<string, 1 | -1>, skip: number, limit: number) => {
        return BikeModel.find(filter).sort(sort).skip(skip).limit(limit).populate("ownerId");
    },
    count: (filter: Record<string, unknown>) => BikeModel.countDocuments(filter),
    findByOwnerId: (ownerId: string) => BikeModel.find({ ownerId }),
    recomputeRating: async (bikeId: string, averageRating: number, ratingCount: number) => BikeModel.findByIdAndUpdate(bikeId, { averageRating, ratingCount }, { new: true }),
};
