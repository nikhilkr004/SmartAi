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
      "You are an expert tutor writing highly comprehensive, detailed study notes for a student.",
      "Below is a transcript from a classroom session or educational video.",
      "Your critical task is to extract and beautifully organize EVERYTHING taught in this lecture.",
      "",
      "IMPORTANT INSTRUCTIONS:",
      "- DO NOT just provide a brief overview or simple timestamps. You MUST read the entire transcript and explain all the actual educational topics, formulas, concepts, and details mentioned.",
      "- TOPIC-AWARE FORMATTING: Dynamically adjust your formatting based on the subject. For example, if it is a programming lecture, include clear code blocks. If it is a history lecture, use timelines. If it is science, explain the processes in detail.",
      "- Write the notes in a highly conversational, engaging, and human-like tone, as if a brilliant classmate wrote them to help you study.",
      "- Explain complex rules or topics simply as if you were talking to a friend.",
      "- Organize the notes logically using headers and bullet points so it is easy to read.",
      "- Provide specific examples that the teacher used.",
      "- CREATE A DIAGRAM: You MUST include exactly ONE visual aid in the form of Mermaid.js code (like a concept mindmap or flowchart of the main ideas). Wrap the code EXACTLY inside ```mermaid and ``` tags. Ensure the Mermaid syntax is valid and concise.",
      "- Keep the original language (if Hindi was spoken, write the concepts out conversationally in Hindi/English).",
      "",
      "TRANSCRIPT:",
      transcript
    ].join("\n");

    const result = await model.generateContent([
      { text: "You are a friendly note-taker. You write very human, conversational summaries and notes of everything spoken." },
      { text: prompt }
    ]);

    const text = result.response.text()?.trim();
    if (!text) {
      console.error("[GEMINI] Model returned empty notes.");
      throw Object.assign(new Error("Gemini returned empty notes"), { statusCode: 502 });
    }

    let cleanNotes = text;
    let mermaidCode = null;
    const mermaidRegex = /```mermaid([\s\S]*?)```/i;
    const match = cleanNotes.match(mermaidRegex);
    
    if (match && match[1]) {
      mermaidCode = match[1].trim();
      // Strip raw code block from the final readable notes
      cleanNotes = cleanNotes.replace(mermaidRegex, "").trim();
    }

    return { notes: cleanNotes, mermaidCode };
  } catch (err) {
    console.error("[GEMINI GPT ERROR]", err);
    throw Object.assign(new Error(`Gemini notes error: ${err.message}`), { statusCode: 502 });
  }
}

