import admin from "firebase-admin";
import fs from "fs/promises";

let initialized = false;

async function loadServiceAccount() {
  // Check for raw JSON string first (ideal for Railway/Cloud)
  const jsonRaw = process.env.FIREBASE_CREDENTIALS_JSON;
  if (jsonRaw) {
    try {
      return JSON.parse(jsonRaw);
    } catch (err) {
      console.error("FIREBASE_CREDENTIALS_JSON parsing failed:", err.message);
      throw Object.assign(new Error("Invalid FIREBASE_CREDENTIALS_JSON environment variable"), { statusCode: 500 });
    }
  }

  // Fallback to file path (local development)
  const p = process.env.FIREBASE_CREDENTIALS_PATH;
  if (!p) {
    throw Object.assign(new Error("Neither FIREBASE_CREDENTIALS_JSON nor FIREBASE_CREDENTIALS_PATH is set"), { statusCode: 500 });
  }

  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Firebase credentials file read failed at ${p}:`, err.message);
    throw Object.assign(new Error("Missing or invalid Firebase credentials file"), { statusCode: 500 });
  }
}

export async function initFirebase() {
  if (initialized) return admin;

  const bucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucket) {
    throw Object.assign(new Error("FIREBASE_STORAGE_BUCKET is not set"), { statusCode: 500 });
  }

  const serviceAccount = await loadServiceAccount();

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: bucket
  });

  initialized = true;
  return admin;
}

