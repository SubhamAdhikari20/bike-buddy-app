// backend/src/interfaces/admin.repository.interface.ts
import type { IAdmin } from "./../models/admin.model.ts";

export interface AdminRepositoryInterface {
    create(data: Record<string, unknown>): Promise<IAdmin>;
    findById(id: string): Promise<IAdmin | null>;
    findByBaseUserId(baseUserId: string): Promise<IAdmin | null>;
    updateById(id: string, data: Record<string, unknown>): Promise<IAdmin | null>;
    deleteById(id: string): Promise<IAdmin | null>;
    list(filter?: Record<string, unknown>): Promise<IAdmin[]>;
    count(filter?: Record<string, unknown>): Promise<number>;
}
