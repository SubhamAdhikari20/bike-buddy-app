// backend/src/interfaces/renter.repository.interface.ts
import type { IRenter } from "./../models/renter.model.ts";

export interface RenterRepositoryInterface {
    create(data: Record<string, unknown>): Promise<IRenter>;
    findById(id: string): Promise<IRenter | null>;
    findByBaseUserId(baseUserId: string): Promise<IRenter | null>;
    updateById(id: string, data: Record<string, unknown>): Promise<IRenter | null>;
    deleteById(id: string): Promise<IRenter | null>;
    list(filter?: Record<string, unknown>): Promise<IRenter[]>;
    count(filter?: Record<string, unknown>): Promise<number>;
}
