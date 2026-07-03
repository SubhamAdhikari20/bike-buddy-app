// backend/src/types/api-response.type.ts

export interface ApiResponseType {
    success: boolean;
    message: string;
    status?: number | null;
    data?: any | null;
}