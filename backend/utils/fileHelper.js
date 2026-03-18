import fs from "fs/promises";
import path from "path";
import os from "os";

export function isValidHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export function getTmpDir() {
  return path.join(os.tmpdir(), "smart-classroom-assistant");
}

export async function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}

