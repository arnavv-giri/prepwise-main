import express from "express";
import { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/authRoutes";
import problemRoutes from "./routes/problemRoutes";
import submissionRoutes from "./routes/submissionRoutes";
import leaderboardRoutes from "./routes/leaderboardRoutes";
import userRoutes from "./routes/userRoutes";
import runRoutes from "./routes/runRoutes";

import { protect } from "./middleware/authMiddleware";
import { globalErrorHandler } from "./middleware/errorHandler";
import adminRoutes from "./routes/adminRoutes";
dotenv.config();

const app = express();

app.set("trust proxy", 1);

const allowedOrigins = [
  "http://localhost:5173",
  "https://skilltrack-delta.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (origin.endsWith(".vercel.app")) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(express.json({ limit: "50kb" }));

app.use("/api/auth", authRoutes);
app.use("/api/problems", problemRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/users", userRoutes);
app.use("/api/run", runRoutes);
app.use("/api/admin", adminRoutes);

app.get("/", (req, res) => {
  res.send("SkillTrack API is running 🚀");
});

app.get("/health", async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? "connected" : "disconnected";
  const status = dbState === 1 ? "ok" : "degraded";
  res.status(dbState === 1 ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    services: { database: dbStatus },
  });
});

// Debug endpoint — remove after fixing
app.get("/debug-env", (req, res) => {
  res.json({
    INTERNAL_SECRET_SET: !!process.env.INTERNAL_SECRET,
    INTERNAL_SECRET_LENGTH: process.env.INTERNAL_SECRET?.length || 0,
    INTERNAL_SECRET_PREVIEW: process.env.INTERNAL_SECRET?.slice(0, 8) || "NOT SET",
    EXECUTION_ENGINE_URL: process.env.EXECUTION_ENGINE_URL || "NOT SET",
  });
});

app.get("/api/test/protected", protect, (req: Request, res: Response) => {
  res.json({ message: "You accessed a protected route", user: req.user });
});

app.use(globalErrorHandler);

const PORT = process.env.PORT || 5000;

export { app };

const startServer = async () => {
  try {
    console.log("[ENV] INTERNAL_SECRET set:", !!process.env.INTERNAL_SECRET);
    console.log("[ENV] INTERNAL_SECRET length:", process.env.INTERNAL_SECRET?.length || 0);
    console.log("[ENV] EXECUTION_ENGINE_URL:", process.env.EXECUTION_ENGINE_URL || "NOT SET");

    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error);
  }
};

if (require.main === module) {
  void startServer();
}
