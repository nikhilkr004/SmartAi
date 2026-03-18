import multer from "multer";
import path from "path";
import { getTmpDir, ensureDir } from "./fileHelper.js";

import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tmpDir = getTmpDir();
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    cb(null, tmpDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".mp4";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit for recordings
  }
});
