// backend/src/repositories/renter.repository.ts
import type { RenterRepositoryInterface } from "./../interfaces/renter.repository.interface.ts";
import RenterModel from "./../models/renter.model.ts";

export const renterRepository: RenterRepositoryInterface = {
  create: (data) => RenterModel.create(data),
  findById: (id) => RenterModel.findById(id).exec(),
  findByBaseUserId: (baseUserId) => RenterModel.findOne({ baseUserId }).exec(),
  findByGoogleId: (googleId) => RenterModel.findOne({ googleId }).exec(),
  findByBaseUserIdWithPassword: (baseUserId) =>
    RenterModel.findOne({ baseUserId }).select("+password").exec(),
  updateById: (id, data) =>
    RenterModel.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    }).exec(),
  deleteById: (id) => RenterModel.findByIdAndDelete(id).exec(),
  list: (filter = {}, options = {}) =>
    RenterModel.find(filter)
      .sort(options.sort ?? { createdAt: -1 })
      .skip(options.skip ?? 0)
      .limit(options.limit ?? 0)
      .populate("baseUserId", "email isVerified")
      .exec(),
  count: (filter = {}) => RenterModel.countDocuments(filter).exec(),
};
