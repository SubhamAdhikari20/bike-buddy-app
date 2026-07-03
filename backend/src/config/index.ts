// src/config/index.ts
import dotenv from "dotenv";

dotenv.config();

export const PORT: number = process.env.PORT ? parseInt(process.env.PORT) : 5050;
export const MONGODB_URI: string = process.env.MONGODB_URI || "mongodb://localhost:27017/default_db";
export const JWT_SECRET: string = process.env.JWT_SECRET || "bike_buddy_secret";
export const JWT_SIGNUP_EXPIRES_IN: string = process.env.JWT_SIGNUP_EXPIRES_IN || "1d";
export const JWT_LOGIN_EXPIRES_IN: string = process.env.JWT_LOGIN_EXPIRES_IN || "30d";
export const FRONTEND_URL: string = process.env.FRONTEND_URL || "http://localhost:3000";
export const BACKEND_URL: string = process.env.BACKEND_URL || `http://localhost:${PORT}`;
export const MEDIA_STORAGE_PROVIDER: string = process.env.MEDIA_STORAGE_PROVIDER || "local";