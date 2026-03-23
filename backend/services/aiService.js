import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { Anthropic } from "@anthropic-ai/sdk";
import path from "path";
import { safeUnlink } from "../utils/fileHelper.js";
import { extractAudio } from "../utils/visualHelper.js";

// --- Claude Configuration ---
function getClaudeClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[CLAUDE] ANTHROPIC_API_KEY not found. Falling back to Gemini for notes.");
    return null;
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function generateClaudeNotes(transcript, contentType = "General", topic = null) {
  const anthropic = getClaudeClient();
  if (!anthropic) return null; // Fallback will be handled in controller

  console.log(`[CLAUDE] Generating Elite Notes for Topic: ${topic || 'Unspecified'}...`);
  const startTime = Date.now();

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 4000,
      system: "You are a world-class academic scribe. Convert transcripts into 'Masterclass' study guides. Focus on structure, logic, and visual representation (Mermaid/Charts).",
      messages: [
        {
          role: "user",
          content: `
            TRANSCRIPT:
            ${transcript}

            TASK: Create a professional study guide based on this lecture.
            CONTEXT: ${contentType}${topic ? ` | TOPIC: ${topic}` : ""}.

            STRUCTURE MUST BE:
            1. # EXECUTIVE SUMMARY: 3 punchy, high-impact points.
            2. # CONCEPTUAL DEEP DIVE: Use ## for each core concept. Include [TIP], [DEF], [HINT], and [EX] callouts.
            3. # VISUAL FLOWS: Provide exactly TWO (2) \`\`\`mermaid graph TD blocks explaining the logic.
            4. # DATA INSIGHTS: Provide ONE (1) \`\`\`chartjs block if any data exists.
            5. # MASTERCLASS CHEAT SHEET: A final glossary or formula list.

            STYLE: Use bold text for key terms. Keep points clear and professional. Avoid verbosity.
          `
        }
      ]
    });

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[CLAUDE] Notes generated in ${duration}s`);
    return response.content[0].text;
  } catch (err) {
    console.error("[CLAUDE ERROR]", err);
    return null; // Let the controller handle fallback
  }
}

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
    
    // DIAGNOSTIC: List available models if 404 occurs
    const listModelsSilent = async () => {
      try {
        const result = await client.listModels();
        console.log("[GEMINI DIAGNOSTIC] Available models:", result.models.map(m => m.name).join(", "));
      } catch (e) {
        console.warn("[GEMINI DIAGNOSTIC] Failed to list models:", e.message);
      }
    };

    console.log(`[GEMINI] Generating Transcript & Notes (Consolidated Turn)...`);
    const prompt = `
      Analyze the attached audio professionally.
      
      RETURN ONLY A JSON OBJECT:
      {
        "transcript": "Full accurate transcription text...",
        "notes": "Premium study notes in Markdown..."
      }

      CRITICAL: Ensure the response is VALID JSON.
    `;

    // Strategy: Try multiple model IDs in sequence
    const modelIds = ["gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-1.5-pro"];
    let result = null;
    let lastError = null;

    for (const modelId of modelIds) {
      try {
        console.log(`[GEMINI] Attempting with model: ${modelId}...`);
        const model = client.getGenerativeModel({ model: modelId });
        result = await model.generateContent([
          {
            fileData: {
              mimeType: uploadResult.file.mimeType,
              fileUri: uploadResult.file.uri
            }
          },
          { text: prompt }
        ]);
        if (result) break;
      } catch (err) {
        lastError = err;
        console.warn(`[GEMINI] Model ${modelId} failed: ${err.message}`);
        if (err.message.includes("404")) {
           await listModelsSilent();
        }
      }
    }

    if (!result) throw lastError;

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[GEMINI] Consolidated processing complete in ${duration}s`);
    
    // Clean up markdown block if Gemini wraps JSON in backticks
    let rawText = result.response.text();
    rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const responseJson = JSON.parse(rawText);
    
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

