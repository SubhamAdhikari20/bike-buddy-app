export type AuthRole = "admin" | "owner" | "renter";

export type AuthUser = {
    userId: string;
    role: AuthRole;
    profileId?: string;
};
