import express from "express";
import dotenv from "dotenv";
import executeRouter from "./routes/execute.route";

dotenv.config();

const app = express();

/* ============================= */
/* Body Parser FIRST             */
/* ============================= */

app.use(express.json({ limit: "100kb" }));

/* ============================= */
/* Health Check (no auth)        */
/* ============================= */

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "execution-engine" });
});

/* ============================= */
/* Debug endpoint (no auth)      */
/* ============================= */

app.post("/debug", (req, res) => {
  const token = req.headers["x-internal-token"];
  const secret = process.env.INTERNAL_SECRET;
  res.json({
    receivedToken: token || "MISSING",
    secretSet: !!secret,
    secretLength: secret?.length || 0,
    match: token === secret,
    body: req.body,
  });
});

/* ============================= */
/* Internal Auth Guard          */
/* ============================= */

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

if (!INTERNAL_SECRET) {
  throw new Error(
    "INTERNAL_SECRET environment variable is not set. " +
    "Set a strong random string shared between the server and execution engine."
  );
}

app.use((req, res, next) => {
  const token = req.headers["x-internal-token"];

  if (token !== INTERNAL_SECRET) {
    console.error(`[AUTH FAIL] Expected: "${INTERNAL_SECRET?.slice(0, 8)}..." Got: "${String(token).slice(0, 8)}..."`);
    return res.status(401).json({ error: "Unauthorized", hint: "INTERNAL_SECRET mismatch" });
  }

  console.log(`[AUTH OK] ${req.method} ${req.path}`);
  next();
});

/* ============================= */
/* Routes                       */
/* ============================= */

app.use("/execute", executeRouter);
app.use("/", executeRouter);

/* ============================= */
/* Start                        */
/* ============================= */

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Execution engine running on port ${PORT}`);
});
