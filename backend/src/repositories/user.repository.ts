// backend/src/repositories/user.repository.ts
import type { UserRepositoryInterface } from "./../interfaces/user.repository.interface.ts";
import UserModel from "./../models/user.model.ts";

export const userRepository: UserRepositoryInterface = {
    create: (data) => UserModel.create(data),
    findById: (id) => UserModel.findById(id).exec(),
    findByEmail: (email) => UserModel.findOne({ email }).exec(),
    updateById: (id, data) => UserModel.findByIdAndUpdate(id, data, { new: true }).exec(),
    deleteById: (id) => UserModel.findByIdAndDelete(id).exec(),
    list: (filter = {}, options = {}) => {
        let query = UserModel.find(filter);
        if (options.sort) query = query.sort(options.sort);
        if (options.skip !== undefined) query = query.skip(options.skip);
        if (options.limit !== undefined) query = query.limit(options.limit);
        return query.exec();
    },
    count: (filter = {}) => UserModel.countDocuments(filter).exec(),
};
