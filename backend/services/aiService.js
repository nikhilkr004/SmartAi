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

export function getFileManager() {
  requireGeminiKey();
  const key = process.env.GEMINI_API_KEY;
  return new GoogleAIFileManager(key);
}

/**
 * Deletes a file from Gemini servers.
 */
export async function deleteGeminiFile(fileName) {
  try {
    const fileManager = getFileManager();
    await fileManager.deleteFile(fileName);
    console.log(`[GEMINI] Deleted temporary file from Gemini server: ${fileName}`);
  } catch (e) {
    console.warn(`[GEMINI] Failed to delete remote file: ${e.message}`);
  }
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
    
    return { 
      transcript: text, 
      videoFileData: {
        mimeType: uploadResult.file.mimeType,
        fileUri: uploadResult.file.uri
      },
      geminiFileName: uploadResult.file.name
    };
  } catch (err) {
    throw Object.assign(new Error(`Gemini transcription error: ${err.message}`), {
      statusCode: 502
    });
  }
}

export async function generateStructuredNotes(transcript, videoFileData = null) {
  try {
    const client = getClient();
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

    const promptParts = [
      { text: "You are an expert tutor writing highly comprehensive, detailed, and beautifully structured study notes for a student." },
      { text: `Below is a transcript from a classroom session or educational video: \n\n${transcript}` },
      { text: "Your critical task is to extract and beautifully organize EVERYTHING taught in this lecture." },
      { text: "IMPORTANT INSTRUCTIONS:" },
      { text: "- DO NOT just provide a brief overview or simple timestamps. You MUST read the entire transcript and explain all the actual educational topics, formulas, concepts, and details mentioned." },
      { text: "- TOPIC-AWARE FORMATTING: Dynamically adjust your formatting based on the subject (e.g., code blocks for programming, timelines for history)." },
      { text: "- Write in a highly conversational, engaging, and human-like tone, as if a brilliant classmate wrote them." },
      { text: "- CREATE A DIAGRAM: You MUST include exactly ONE visual aid in the form of Mermaid.js code wrapped in ```mermaid tags." }
    ];

    if (videoFileData) {
      promptParts.push({
        text: "VISUAL INSIGHTS: You have access to the video recording itself. Please identify the 2-3 most important visual moments (e.g., when code, a diagram, or a key slide is shown on screen). Return their exact timestamps in seconds as a JSON list at the very end of your response, formatted exactly like this: [VISUAL_MOMENTS: 4.5, 12.0, 30.5]. Provide a brief context for each screenshot in your notes."
      });
      promptParts.push({
        fileData: videoFileData
      });
    }

    const result = await model.generateContent(promptParts);

    const text = result.response.text()?.trim();
    if (!text) {
      console.error("[GEMINI] Model returned empty notes.");
      throw Object.assign(new Error("Gemini returned empty notes"), { statusCode: 502 });
    }

    let cleanNotes = text;
    let mermaidCode = null;
    let visualTimestamps = [];

    // Extract Mermaid
    const mermaidRegex = /```mermaid([\s\S]*?)```/i;
    const mermaidMatch = cleanNotes.match(mermaidRegex);
    if (mermaidMatch && mermaidMatch[1]) {
      mermaidCode = mermaidMatch[1].trim();
      cleanNotes = cleanNotes.replace(mermaidRegex, "").trim();
    }

    // Extract Visual Moments
    const momentsRegex = /\[VISUAL_MOMENTS:\s*([\d\.,\s]+)\]/i;
    const momentsMatch = cleanNotes.match(momentsRegex);
    if (momentsMatch && momentsMatch[1]) {
      visualTimestamps = momentsMatch[1].split(',')
        .map(t => parseFloat(t.trim()))
        .filter(t => !isNaN(t));
      cleanNotes = cleanNotes.replace(momentsRegex, "").trim();
    }

    return { notes: cleanNotes, mermaidCode, visualTimestamps };
  } catch (err) {
    console.error("[GEMINI GPT ERROR]", err);
    throw Object.assign(new Error(`Gemini notes error: ${err.message}`), { statusCode: 502 });
  }
}

