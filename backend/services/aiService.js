import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import path from "path";
import { safeUnlink } from "../utils/fileHelper.js";
import { extractAudio } from "../utils/visualHelper.js";

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

export async function generateStudyMaterials(videoPath, contentType = "General", topic = null) {
  let uploadResult = null;
  let tempAudioPath = null;
  const fileManager = getFileManager();
  
  try {
    const stats = fs.statSync(videoPath);
    console.log(`[GEMINI] Processing Video: ${videoPath} (${stats.size} bytes)`);

    // Extract audio (69MB -> ~3MB)
    tempAudioPath = await extractAudio(videoPath);
    const audioStats = fs.statSync(tempAudioPath);
    
    console.log(`[GEMINI] Uploading Audio: ${audioStats.size} bytes...`);
    const startTime = Date.now();
    
    uploadResult = await fileManager.uploadFile(tempAudioPath, {
      mimeType: "audio/mp3",
      displayName: path.basename(tempAudioPath),
    });
    
    // Clean up local temp audio early
    await safeUnlink(tempAudioPath);
    tempAudioPath = null;

    // Wait for processing
    let fileState = await fileManager.getFile(uploadResult.file.name);
    while (fileState.state === "PROCESSING") {
      await new Promise(resolve => setTimeout(resolve, 3000));
      fileState = await fileManager.getFile(uploadResult.file.name);
    }
    
    if (fileState.state === "FAILED") throw new Error("Gemini failed to process file.");

    const client = getClient();
    // Use prompt-based JSON instead of strict schema for better compatibility
    const model = client.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    console.log(`[GEMINI] Generating Transcript & Notes (Consolidated Turn)...`);
    const prompt = `
      You are a World-Class Academic Tutor. 
      Analyze the attached audio comprehensively.
      
      RETURN A JSON OBJECT WITH THESE EXACT KEYS:
      {
        "transcript": "Full accurate transcription text...",
        "notes": "Masterclass study notes in Markdown..."
      }

      TASK 1: Provide a highly accurate transcription in the "transcript" field.
      TASK 2: Create "Masterclass" quality study notes in the "notes" field.
      
      CONTEXT: ${contentType}${topic ? ` | TOPIC: ${topic}` : ""}.
      
      NOTES STRUCTURE (Markdown):
      1. # EXECUTIVE SUMMARY
      2. # DEEP DIVE (with ## headings and [TIP], [DEF], [HINT], [EX])
      3. # DIAGRAM FLOWS (Include TWO \`\`\`mermaid blocks)
      4. # DATA VISUALIZATION (Include ONE \`\`\`chartjs block)
      5. # MASTERCLASS CHEAT SHEET

      CRITICAL: Ensure the response is VALID JSON. Escape newlines in the strings.
    `;

    const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadResult.file.mimeType,
          fileUri: uploadResult.file.uri
        }
      },
      { text: prompt }
    ]);

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[GEMINI] Consolidated processing complete in ${duration}s`);
    
    const responseJson = JSON.parse(result.response.text());
    
    return { 
      transcript: responseJson.transcript, 
      notes: responseJson.notes,
      videoFileData: {
        mimeType: uploadResult.file.mimeType,
        fileUri: uploadResult.file.uri
      },
      geminiFileName: uploadResult.file.name
    };
  } catch (err) {
    console.error("[GEMINI ERROR]", err);
    throw Object.assign(new Error(`Gemini processing error: ${err.message}`), { statusCode: 502 });
  } finally {
    if (tempAudioPath) await safeUnlink(tempAudioPath);
  }
}

