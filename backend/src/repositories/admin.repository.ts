// backend/src/repositories/admin.repository.ts
import type { AdminRepositoryInterface } from "./../interfaces/admin.repository.interface.ts";
import AdminModel from "./../models/admin.model.ts";

export const adminRepository: AdminRepositoryInterface = {
    create: (data) => AdminModel.create(data),
    findById: (id) => AdminModel.findById(id).exec(),
    findByBaseUserId: (baseUserId) => AdminModel.findOne({ baseUserId }).exec(),
    updateById: (id, data) => AdminModel.findByIdAndUpdate(id, data, { new: true }).exec(),
    deleteById: (id) => AdminModel.findByIdAndDelete(id).exec(),
    list: (filter = {}) => AdminModel.find(filter).exec(),
    count: (filter = {}) => AdminModel.countDocuments(filter).exec(),
};
