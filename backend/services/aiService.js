import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";
import path from "path";
import { safeUnlink } from "../utils/fileHelper.js";
import { extractAudio } from "../utils/visualHelper.js";

// --- OpenAI Configuration (Whisper) ---
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[OPENAI] API Key not found.");
    return null;
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function transcribeWithWhisper(audioPath) {
  const openai = getOpenAIClient();
  if (!openai) return null;

  console.log(`[OPENAI] Transcribing ${audioPath}...`);
  const startTime = Date.now();
  
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1",
    });

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[OPENAI] Transcription complete in ${duration}s`);
    return transcription.text;
  } catch (err) {
    console.error("[OPENAI ERROR]", err);
    return null;
  }
}

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
  let tempAudioPath = null;
  
  try {
    const stats = fs.statSync(videoPath);
    console.log(`[GEMINI] Processing Video: ${videoPath} (${stats.size} bytes)`);

    // Extract audio (69MB -> ~3MB)
    tempAudioPath = await extractAudio(videoPath);
    const audioStats = fs.statSync(tempAudioPath);
    
    console.log(`[GEMINI] Preparing Inline Audio: ${audioStats.size} bytes...`);
    const startTime = Date.now();
    
    // Convert to base64 for inline transmission
    const audioBase64 = fs.readFileSync(tempAudioPath).toString("base64");
    
    // Clean up local temp audio immediately
    await safeUnlink(tempAudioPath);
    tempAudioPath = null;

    const client = getClient();
    const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

    console.log(`[GEMINI] Generating Transcript & Notes (Consolidated Inline Turn)...`);
    const prompt = `
      Analyze the attached audio professionally.
      
      RETURN ONLY A JSON OBJECT:
      {
        "transcript": "Full accurate transcription text...",
        "notes": "Premium study notes in Markdown..."
      }

      CRITICAL: Ensure the response is VALID JSON.
    `;

    const result = await model.generateContent([
      {
        inlineData: {
          data: audioBase64,
          mimeType: "audio/mp3"
        }
      },
      { text: prompt }
    ]);

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[GEMINI] Consolidated inline processing complete in ${duration}s`);
    
    // Clean up markdown block if Gemini wraps JSON in backticks
    let rawText = result.response.text();
    rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const responseJson = JSON.parse(rawText);
    
    return { 
      transcript: responseJson.transcript, 
      notes: responseJson.notes,
      geminiFileName: null // No remote file to clean up in inline mode
    };
  } catch (err) {
    console.error("[GEMINI ERROR]", err);
    throw Object.assign(new Error(`Gemini processing error: ${err.message}`), { statusCode: 502 });
  } finally {
    if (tempAudioPath) await safeUnlink(tempAudioPath);
  }
}

