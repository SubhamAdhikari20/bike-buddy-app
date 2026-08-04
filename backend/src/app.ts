// src/app.ts
import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import path from "path";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import helmet from "helmet";
import "colors";
import apiRoutes from "./routes/index.ts";
import authRoutes from "./routes/auth.routes.ts";
import notFound from "./middlewares/notFound.ts";
import errorHandler from "./middlewares/errorHandler.ts";
import { FRONTEND_URL } from "./config/index.ts";

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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

  const sanitize = (obj: any) => {
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
          sanitize(obj[key]);
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

// Configure CORS
const corsOptions = {
  origin: function (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void,
  ) {
    const allowedOrigins = (process.env.CORS_ORIGIN || FRONTEND_URL)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
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
app.use(limiter);
const publicUploadOptions = {
  dotfiles: "deny" as const,
  index: false,
  setHeaders: (res: Response) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=86400");
  },
};
for (const kind of ["bike", "profile"] as const) {
  app.use(
    `/uploads/${kind}`,
    express.static(path.join(process.cwd(), "uploads", kind), publicUploadOptions),
  );
}

app.get("/health", (_req: Request, res: Response) => {
  res
    .status(200)
    .json({ success: true, message: "Bike Buddy backend is healthy" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", apiRoutes);

app.get("/", (_req: Request, res: Response) => {
  res.send("Hello, World!");
});

app.use(notFound);
app.use(errorHandler);

export default app;
