import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import path from "path";
import { safeUnlink } from "../utils/fileHelper.js";

function requireGeminiKey() {
  if (!process.env.GEMINI_API_KEY) {
    throw Object.assign(new Error("GEMINI_API_KEY is not set"), { statusCode: 500 });
  }
}

function getClient() {
  requireGeminiKey();
  const key = process.env.GEMINI_API_KEY;
  console.log(`[AI SERVICE] Initializing Gemini client...`);
  return new GoogleGenerativeAI(key);
}

function getFileManager() {
  requireGeminiKey();
  const key = process.env.GEMINI_API_KEY;
  return new GoogleAIFileManager(key);
}

export async function transcribeAudio(audioPath) {
  let uploadResult = null;
  const fileManager = getFileManager();
  
  try {
    const stats = fs.statSync(audioPath);
    console.log(`[GEMINI] File: ${audioPath} (${stats.size} bytes)`);

    console.log(`[GEMINI] Starting file upload to Gemini...`);
    const startTime = Date.now();
    
    // Guess mime type from extension
    const ext = path.extname(audioPath).toLowerCase();
    let mimeType = "audio/mp3";
    if (ext === ".wav") mimeType = "audio/wav";
    else if (ext === ".m4a") mimeType = "audio/m4a";
    else if (ext === ".ogg") mimeType = "audio/ogg";
    else if (ext === ".webm") mimeType = "audio/webm";
    else if (ext === ".mp4") mimeType = "video/mp4";

    uploadResult = await fileManager.uploadFile(audioPath, {
      mimeType: mimeType,
      displayName: path.basename(audioPath),
    });
    
    console.log(`[GEMINI] Upload successful. URI: ${uploadResult.file.uri}. Waiting for processing...`);

    // Wait for the file to finish processing (crucial for video/mp4 files)
    let fileState = await fileManager.getFile(uploadResult.file.name);
    while (fileState.state === "PROCESSING") {
      console.log(`[GEMINI] File processing... waiting 3 seconds.`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      fileState = await fileManager.getFile(uploadResult.file.name);
    }
    
    if (fileState.state === "FAILED") {
      throw Object.assign(new Error("Gemini failed to process the media file."), { statusCode: 502 });
    }

    const client = getClient();
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

    console.log(`[GEMINI] Generating transcription...`);
    // Note: Gemini understands audio naturally natively
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadResult.file.mimeType,
          fileUri: uploadResult.file.uri
        }
      },
      { text: "Please provide a highly accurate transcription of this audio file. Preserve the original language and capture all spoken words clearly." }
    ]);

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[GEMINI] Success! Took ${duration}s`);
    
    const text = result.response.text()?.trim();
    if (!text) {
      console.error("[GEMINI] Transcription returned empty text.");
      throw Object.assign(new Error("Transcription returned empty text"), { statusCode: 502 });
    }
    
    return text;
  } catch (err) {
    console.error("[GEMINI ERROR DETAIL]", err);
    throw Object.assign(new Error(`Gemini transcription error: ${err.message}`), {
      statusCode: 502
    });
  } finally {
    if (uploadResult && uploadResult.file) {
      try {
        await fileManager.deleteFile(uploadResult.file.name);
        console.log(`[GEMINI] Deleted temporary file from Gemini server: ${uploadResult.file.name}`);
      } catch (e) {
        console.warn(`[GEMINI] Failed to delete remote file: ${e.message}`);
      }
    }
  }
}

export async function generateStructuredNotes(transcript) {
  try {
    const client = getClient();
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = [
      "You are a professional educational assistant.",
      "Below is a transcript from a classroom session.",
      "Please transform this transcript into highly structured, comprehensive, and easy-to-read student notes.",
      "",
      "IMPORTANT INSTRUCTIONS:",
      "- Maintain the original language of the discussion (e.g., if the transcript is in Hindi or Hinglish, keep the notes in that style).",
      "- Use a professional tone.",
      "- Organize with clear, bold headers.",
      "",
      "STRUCTURE:",
      "1. **Lecture Title**: (Create a concise, relevant title)",
      "2. **Executive Summary**: (2-3 sentences max)",
      "3. **Key Concepts & Definitions**: (List all important terms discussed)",
      "4. **Examples & Illustrations**: (Detailed examples provided by the teacher)",
      "5. **Action Items / Homework**: (Any tasks mentioned)",
      "6. **Short Quiz**: (5 multiple choice or fill-in-the-blank questions with answers)",
      "",
      "TRANSCRIPT:",
      transcript
    ].join("\n");

    const result = await model.generateContent([
      { text: "You are a master at taking notes from classroom lectures. You produce detailed, structured, and helpful student resources in the lecture's primary language." },
      { text: prompt }
    ]);

    const notes = result.response.text()?.trim();
    if (!notes) {
      console.error("[GEMINI] Model returned empty notes.");
      throw Object.assign(new Error("Gemini returned empty notes"), { statusCode: 502 });
    }
    return notes;
  } catch (err) {
    console.error("[GEMINI GPT ERROR]", err);
    throw Object.assign(new Error(`Gemini notes error: ${err.message}`), { statusCode: 502 });
  }
}

