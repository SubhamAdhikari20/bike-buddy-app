// backend/src/repositories/renter.repository.ts
import type { RenterRepositoryInterface } from "./../interfaces/renter.repository.interface.ts";
import RenterModel from "./../models/renter.model.ts";

export const renterRepository: RenterRepositoryInterface = {
    create: (data) => RenterModel.create(data),
    findById: (id) => RenterModel.findById(id).exec(),
    findByBaseUserId: (baseUserId) => RenterModel.findOne({ baseUserId }).exec(),
    updateById: (id, data) => RenterModel.findByIdAndUpdate(id, data, { new: true }).exec(),
    deleteById: (id) => RenterModel.findByIdAndDelete(id).exec(),
    list: (filter = {}) => RenterModel.find(filter).exec(),
    count: (filter = {}) => RenterModel.countDocuments(filter).exec(),
};
