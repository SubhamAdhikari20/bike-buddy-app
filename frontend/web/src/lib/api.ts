const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050/api/v1";

export type Role = "admin" | "owner" | "renter";

export type AuthSession = {
  user: {
    id: string;
    email: string;
    role: Role;
    isVerified: boolean;
  };
  profile: {
    id: string;
    fullName: string;
    phoneNumber?: string | null;
    profilePictureUrl?: string | null;
    bio?: string | null;
    ownerStatus?: "none" | "pending" | "verified" | "rejected";
  };
};

export type UploadedFile = {
  url: string;
  filename: string;
};

export type UploadedFiles = {
  files: UploadedFile[];
};

export type ApiEnvelope<T> = {
  statusCode: number;
  success: boolean;
  message: string;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiEnvelope<T>> {
  // A multipart upload must not carry an explicit Content-Type: the browser
  // has to set it itself so the multipart boundary is included.
  const isMultipart = options.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body && !isMultipart
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      isRecord(body) && typeof body.message === "string"
        ? body.message
        : "Something went wrong. Please try again.";
    const code =
      isRecord(body) && typeof body.code === "string" ? body.code : undefined;
    throw new ApiError(message, response.status, code);
  }
  return body as ApiEnvelope<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(data ?? {}),
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: (file: File, kind: "profile" | "kyc") => {
    const body = new FormData();
    body.append("file", file);
    return request<UploadedFile>(`/uploads/${kind}`, {
      method: "POST",
      body,
    });
  },
  uploadMany: (files: File[], kind: "bike" | "evidence") => {
    const body = new FormData();
    files.forEach((file) => body.append("files", file));
    return request<UploadedFiles>(`/uploads/${kind}`, {
      method: "POST",
      body,
    });
  },
};
