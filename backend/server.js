import express from "express";
import dotenv from "dotenv";

import processRoute from "./routes/processRoute.js";

dotenv.config();

const app = express();

app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Simple Request Logger
app.use((req, res, next) => {
  console.log(`[SERVER] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use("/", processRoute);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const message = err.message || "Internal Server Error";

  if (status >= 500) {
    // Avoid leaking internal details in production responses.
    console.error(err);
  }

  res.status(status).json({
    error: {
      message,
      status
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

