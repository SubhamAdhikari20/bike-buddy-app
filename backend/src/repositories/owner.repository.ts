// backend/src/repositories/owner.repository.ts
import type { OwnerRepositoryInterface } from "./../interfaces/owner.repository.interface.ts";
import OwnerModel from "./../models/owner.model.ts";

export const ownerRepository: OwnerRepositoryInterface = {
    create: (data) => OwnerModel.create(data),
    findById: (id) => OwnerModel.findById(id).exec(),
    findByBaseUserId: (baseUserId) => OwnerModel.findOne({ baseUserId }).exec(),
    updateById: (id, data) => OwnerModel.findByIdAndUpdate(id, data, { new: true }).exec(),
    deleteById: (id) => OwnerModel.findByIdAndDelete(id).exec(),
    list: (filter = {}) => OwnerModel.find(filter).exec(),
    count: (filter = {}) => OwnerModel.countDocuments(filter).exec(),
};
