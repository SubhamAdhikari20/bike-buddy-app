// src/lib/api.ts
// Small client-side API wrapper for the Bike Buddy backend.

const API_BASE =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050/api/v1";

export type Session = {
    token: string;
    role: "admin" | "owner" | "renter";
    email: string;
    fullName: string;
    profileId?: string;
};

export const session = {
    save(data: Session) {
        localStorage.setItem("bb_session", JSON.stringify(data));
    },
    get(): Session | null {
        if (typeof window === "undefined") return null;
        const raw = localStorage.getItem("bb_session");
        if (!raw) return null;
        try {
            return JSON.parse(raw) as Session;
        } catch {
            return null;
        }
    },
    clear() {
        localStorage.removeItem("bb_session");
    },
};

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

async function request<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const current = session.get();
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(current ? { Authorization: `Bearer ${current.token}` } : {}),
            ...options.headers,
        },
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new ApiError(
            body.message || "Something went wrong. Please try again.",
            res.status,
        );
    }
    return body as T;
}

export const api = {
    get: <T = any>(path: string) => request<T>(path),
    post: <T = any>(path: string, data?: unknown) =>
        request<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) }),
    patch: <T = any>(path: string, data?: unknown) =>
        request<T>(path, { method: "PATCH", body: JSON.stringify(data ?? {}) }),
    delete: <T = any>(path: string) => request<T>(path, { method: "DELETE" }),
};
