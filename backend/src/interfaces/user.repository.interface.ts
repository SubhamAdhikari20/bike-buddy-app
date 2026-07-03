// backend/src/interfaces/user.repository.interface.ts
import type { IUser } from "./../models/user.model.ts";

export interface UserRepositoryInterface {
    create(data: Partial<IUser>): Promise<IUser>;
    findById(id: string): Promise<IUser | null>;
    findByEmail(email: string): Promise<IUser | null>;
    updateById(id: string, data: Record<string, unknown>): Promise<IUser | null>;
    deleteById(id: string): Promise<IUser | null>;
    list(filter?: Record<string, unknown>, options?: { sort?: Record<string, 1 | -1>; skip?: number; limit?: number }): Promise<IUser[]>;
    count(filter?: Record<string, unknown>): Promise<number>;
}
