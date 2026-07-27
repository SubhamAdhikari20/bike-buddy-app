// backend/src/repositories/owner.repository.ts
import type { OwnerRepositoryInterface } from "./../interfaces/owner.repository.interface.ts";
import OwnerModel from "./../models/owner.model.ts";

export const ownerRepository: OwnerRepositoryInterface = {
  create: (data) => OwnerModel.create(data),
  findById: (id) => OwnerModel.findById(id).exec(),
  findByBaseUserId: (baseUserId) => OwnerModel.findOne({ baseUserId }).exec(),
  findByBaseUserIdWithPassword: (baseUserId) =>
    OwnerModel.findOne({ baseUserId }).select("+password").exec(),
  updateById: (id, data) =>
    OwnerModel.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    }).exec(),
  deleteById: (id) => OwnerModel.findByIdAndDelete(id).exec(),
  list: (filter = {}, options = {}) =>
    OwnerModel.find(filter)
      .sort(options.sort ?? { createdAt: -1 })
      .skip(options.skip ?? 0)
      .limit(options.limit ?? 0)
      .exec(),
  count: (filter = {}) => OwnerModel.countDocuments(filter).exec(),
};
