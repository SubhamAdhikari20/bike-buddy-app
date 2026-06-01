// src/app.ts
import express, { type Application, type Request, type Response } from "express";
import cors from "cors";
// import dotenv from "dotenv";
import path from "path";
import rateLimit from "express-rate-limit";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import helmet from "helmet";
import "colors";

// dotenv.config();

const app: Application = express();

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Rate limiter for auth routes (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    message: "Too many login attempts, please try again after 15 minutes.",
    skipSuccessfulRequests: true, // Don't count successful requests
});

// Middleware
app.use(express.json());
app.use(morgan("dev")); // Logging middleware
app.use(cookieParser());

// Custom security middleware (compatible with Express v5)
app.use((req, res, next) => {
    // Fields that should not be sanitized (emails, URLs, etc.)
    const skipFields = [
        "email",
        "username",
        "password",
        "mediaUrl",
        "profilePicture",
    ];

    const sanitize = (obj: any, parentKey = "") => {
        if (obj && typeof obj === "object") {
            for (const key in obj) {
                // Skip sanitization for specific fields
                if (skipFields.includes(key)) {
                    continue;
                }

                if (typeof obj[key] === "string") {
                    // Prevent NoSQL injection - Remove $ from strings (but keep .)
                    obj[key] = obj[key].replace(/\$/g, "");

                    // Prevent XSS attacks - Only escape HTML in text fields, not emails/URLs
                    if (!obj[key].includes("@") && !obj[key].startsWith("http")) {
                        obj[key] = obj[key].replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    }
                } else if (typeof obj[key] === "object") {
                    sanitize(obj[key], key);
                }
            }
        }
        return obj;
    };

    if (req.body) req.body = sanitize(req.body);
    if (req.params) req.params = sanitize(req.params);
    // Note: req.query is read-only in Express v5, so we skip it

    next();
});

app.use(helmet());
app.use(bodyParser.urlencoded({ extended: true }));

// Configure CORS
const corsOptions = {
    origin: function (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
        const allowedOrigins = process.env.CORS_ORIGIN
            ? process.env.CORS_ORIGIN.split(",")
            : [];
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
// app.use(limiter); // Apply rate limiting to all requests
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));



app.get("/", (req: Request, res: Response) => {
    res.send("Hello, World!");
});

export default app;