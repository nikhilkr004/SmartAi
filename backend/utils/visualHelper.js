import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import path from "path";
import { ensureDir, getTmpDir } from "./fileHelper.js";

// Ensure fluent-ffmpeg knows where the binary is (crucial for Railway)
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log("[VISUAL] FFMPEG Path set:", ffmpegPath);
}
import { v4 as uuidv4 } from "uuid";

/**
 * Extracts a frame from a video at a specific timestamp.
 * @param {string} videoPath - Absolute path to the video file.
 * @param {number} timestampInSeconds - The time in seconds to capture the frame.
 * @returns {Promise<string>} - The absolute path to the extracted JPEG image.
 */
export async function extractFrame(videoPath, timestampInSeconds) {
  const tmpDir = getTmpDir();
  await ensureDir(tmpDir);
  
  const outputFileName = `frame_${uuidv4()}.jpg`;
  const outputPath = path.join(tmpDir, outputFileName);

  return new Promise((resolve, reject) => {
    console.log(`[VISUAL] Extracting frame from ${videoPath} at ${timestampInSeconds}s...`);
    
    ffmpeg(videoPath)
      .screenshots({
        timestamps: [timestampInSeconds],
        filename: outputFileName,
        folder: tmpDir,
        size: '1280x?' // Maintain aspect ratio, fixed width for quality
      })
      .on('end', () => {
        console.log(`[VISUAL] Frame saved to ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`[VISUAL ERROR] FFMPEG failed: ${err.message}`);
        reject(err);
      });
  });
}

/**
 * Extracts multiple frames from a video.
 * @param {string} videoPath 
 * @param {number[]} timestamps 
 * @returns {Promise<string[]>} - List of paths to extracted images.
 */
export async function extractMultipleFrames(videoPath, timestamps) {
  const imagePaths = [];
  // Limit to 3 frames to avoid bloating the PDF or taking too long
  const limitedTimestamps = timestamps.slice(0, 3);
  
  for (const ts of limitedTimestamps) {
    try {
      const imgPath = await extractFrame(videoPath, ts);
      imagePaths.push(imgPath);
    } catch (e) {
      console.warn(`[VISUAL] Skipping frame at ${ts}s due to error.`);
    }
  }
  
  return imagePaths;
}

/**
 * Extracts audio from a video file and saves it as an MP3.
 * Extremely useful for reducing Gemini upload size.
 * @param {string} videoPath 
 * @returns {Promise<string>} - Path to the extracted audio file.
 */
export async function extractAudio(videoPath) {
  const tmpDir = getTmpDir();
  await ensureDir(tmpDir);
  
  const outputFileName = `audio_${uuidv4()}.mp3`;
  const outputPath = path.join(tmpDir, outputFileName);

  return new Promise((resolve, reject) => {
    console.log(`[VISUAL] Extracting audio from ${videoPath}...`);
    
    ffmpeg(videoPath)
      .toFormat('mp3')
      .audioBitrate('128k')
      .on('end', () => {
        console.log(`[VISUAL] Audio extracted to ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`[VISUAL ERROR] Audio extraction failed: ${err.message}`);
        reject(err);
      })
      .save(outputPath);
  });
}
