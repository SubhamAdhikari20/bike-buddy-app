// backend/src/interfaces/owner.repository.interface.ts
import type { IOwner } from "./../models/owner.model.ts";

export interface OwnerRepositoryInterface {
    create(data: Record<string, unknown>): Promise<IOwner>;
    findById(id: string): Promise<IOwner | null>;
    findByBaseUserId(baseUserId: string): Promise<IOwner | null>;
    updateById(id: string, data: Record<string, unknown>): Promise<IOwner | null>;
    deleteById(id: string): Promise<IOwner | null>;
    list(filter?: Record<string, unknown>): Promise<IOwner[]>;
    count(filter?: Record<string, unknown>): Promise<number>;
}
