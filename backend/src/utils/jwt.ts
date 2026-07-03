// backend/src/utils/jwt.ts
import jwt, { type SignOptions } from "jsonwebtoken";
import { JWT_SECRET } from "../config/index.ts";
import type { AuthRole } from "../interfaces/auth.interface.ts";

export type TokenPayload = {
    userId: string;
    role: AuthRole;
    profileId?: string;
};

export const signToken = (payload: TokenPayload, expiresIn: string | number = "1d") => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as Exclude<SignOptions["expiresIn"], undefined> });
};

export const verifyToken = (token: string) => {
    return jwt.verify(token, JWT_SECRET) as TokenPayload & jwt.JwtPayload;
};
