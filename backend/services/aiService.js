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
      { text: "You are an expert tutor writing concise, punchy, and highly visual study notes for a student." },
      { text: `Below is a transcript from a classroom session: \n\n${transcript}` },
      { text: "Your goal: Identify the core 20% of content that gives 80% of the value. Keep it short!" },
      { text: "CRITICAL VISUAL RULES:" },
      { text: "1. DIAGRAMS: You MUST include at least THREE (3) distinct diagrams in D2 notation. Use ```d2 blocks. \n" +
              "   CRITICAL D2 RULES: \n" +
              "   - ALWAYS wrap node names in double quotes if they contain spaces, dots, brackets, or special characters. \n" +
              "   - Example: \"Input Array\" -> \"Arrays.stream()\" -> \"Set\" \n" +
              "   - Keep it simple: Flowcharts are better than complex nested shapes." },
      { text: "2. NO VERBOSITY: Avoid long paragraphs. Use bullet points, bold text, and short 'Insights' boxes." },
      { text: "3. CODE: If code is mentioned, provide a clean snippet with a brief explanation." }
    ];

    if (videoFileData) {
      promptParts.push({
        text: "VISUAL-FIRST ANALYSIS: You have access to the full video. \n" +
              "1. Identify the 3 most critical visual moments (slides, code, or board) and return their timestamps as [VISUAL_MOMENTS: 1.5, 10.2, ...]. \n" +
              "2. FOR EACH TIMESTAMP: Provide a 'Visual Guide' section in your notes. Use 'Arrow Callouts' like this: \n" +
              "- [ARROW: Top Right] This is the main variable declaration. \n" +
              "- [ARROW: Center] Notice how the loop condition is being modified here. \n" +
              "Make it feel like you are pointing to the screen for the student."
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

