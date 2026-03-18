import admin from "firebase-admin";
import fs from "fs/promises";

let initialized = false;

async function loadServiceAccount() {
  const p = process.env.FIREBASE_CREDENTIALS_PATH;
  if (!p) {
    throw Object.assign(new Error("FIREBASE_CREDENTIALS_PATH is not set"), { statusCode: 500 });
  }

  const raw = await fs.readFile(p, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("Invalid Firebase credentials JSON"), { statusCode: 500 });
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

