import axios from "axios";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

import { ensureDir, getTmpDir } from "../utils/fileHelper.js";

function guessExtensionFromContentType(contentType) {
  if (!contentType || typeof contentType !== "string") return ".mp3";
  const ct = contentType.toLowerCase();
  if (ct.includes("audio/wav")) return ".wav";
  if (ct.includes("audio/x-wav")) return ".wav";
  if (ct.includes("audio/mpeg")) return ".mp3";
  if (ct.includes("audio/mp4")) return ".m4a";
  if (ct.includes("audio/x-m4a")) return ".m4a";
  if (ct.includes("audio/webm")) return ".webm";
  if (ct.includes("audio/ogg")) return ".ogg";
  return ".mp3";
}

export async function downloadAudioFromUrl(audioUrl) {
  try {
    const tmpDir = getTmpDir();
    await ensureDir(tmpDir);

    const response = await axios.get(audioUrl, {
      responseType: "stream",
      timeout: 60_000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: (s) => s >= 200 && s < 300
    });

    const ext = guessExtensionFromContentType(response.headers?.["content-type"]);
    const filePath = path.join(tmpDir, `${uuidv4()}${ext}`);

    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    const stat = await fsp.stat(filePath);
    if (!stat.size) {
      throw Object.assign(new Error("Downloaded audio file is empty"), { statusCode: 400 });
    }

    return filePath;
  } catch (err) {
    if (err.code === "ECONNABORTED") {
      throw Object.assign(new Error("Audio download timed out"), { statusCode: 408 });
    }
    if (err.response) {
      throw Object.assign(new Error(`Audio download failed with status ${err.response.status}`), { statusCode: 400 });
    }
    if (err.request) {
      throw Object.assign(new Error("Audio download failed (no response)"), { statusCode: 400 });
    }
    throw Object.assign(new Error(`Audio download failed: ${err.message}`), { statusCode: err.statusCode || 400 });
  }
}

