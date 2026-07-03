import type { AuthUser } from "./auth.interface.ts";

declare global {
    namespace Express {
        interface Request {
            auth?: AuthUser;
        }
    }
}

export {};