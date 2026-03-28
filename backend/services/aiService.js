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

export async function transcribeWithWhisper(audioPath, retryCount = 0) {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error("OpenAI API Key not found. Please add 'OPENAI_API_KEY' to your Environment Variables in the Render Dashboard.");
  }

  console.log(`[OPENAI] Transcribing ${audioPath} (Attempt ${retryCount + 1})...`);
  const startTime = Date.now();
  
  let processingPath = audioPath;
  let isTempFile = false;

  try {
    const stats = fs.statSync(audioPath);
    const sizeInMB = stats.size / (1024 * 1024);

    if (sizeInMB > 24) {
      console.log(`[OPENAI] File size (${sizeInMB.toFixed(1)}MB) exceeds 25MB limit. Compressing...`);
      processingPath = await extractAudio(audioPath);
      isTempFile = true;
      console.log(`[OPENAI] Compressed to ${fs.statSync(processingPath).size / (1024 * 1024).toFixed(1)}MB`);
    }

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(processingPath),
      model: "whisper-1",
    });

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[OPENAI] Transcription complete in ${duration}s`);
    return transcription.text;
  } catch (err) {
    const isNetworkError = 
      err.code === 'ECONNRESET' || 
      err.cause?.code === 'ECONNRESET' || 
      err.code === 'ETIMEDOUT' || 
      err.cause?.code === 'ETIMEDOUT' ||
      err.status === 502 || 
      err.status === 503 || 
      err.status === 504;
    
    if (isNetworkError && retryCount < 2) {
      console.warn(`[OPENAI RETRY] Connection issue (${err.code || err.cause?.code || err.status}). Retrying in 2s...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return transcribeWithWhisper(audioPath, retryCount + 1);
    }

    console.error("[OPENAI ERROR]", err);
    
    if (err.status === 401) {
      throw new Error("Invalid OpenAI API Key. Please check your Render Environment Variables.");
    }
    
    if (err.code === 'ECONNRESET') {
      throw new Error("OpenAI Connection Reset. The network connection was closed unexpectedly. Please try again in a few moments.");
    }

    throw new Error(`Transcription failed: ${err.message || "Unknown error"}`);
  } finally {
    if (isTempFile && processingPath) {
      await safeUnlink(processingPath);
    }
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

// --- OpenAI Configuration (Notes) ---
export async function generateGPTNotes(transcript, contentType = "General", topic = null) {
  const openai = getOpenAIClient();
  if (!openai) return null;

  console.log(`[GPT] Generating Professional Notes for Topic: ${topic || 'Unspecified'}...`);
  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a world-class academic scribe. Convert transcripts into 'Masterclass' study guides. Focus on structure, logic, and visual representation (Mermaid/Charts)."
        },
        {
          role: "user",
          content: `
            TRANSCRIPT:
            ${transcript}

            TASK: Create a professional study guide based on this lecture.
            CONTEXT: ${contentType}${topic ? ` | TOPIC: ${topic}` : ""}.

            STRUCTURE MUST BE:
            1. # EXECUTIVE SUMMARY: 3 punchy points.
            2. # CONCEPTUAL DEEP DIVE: Use ## for concepts. Include [TIP], [DEF], [HINT], [EX].
            3. # VISUAL FLOWS: Provide TWO (2) \`\`\`mermaid blocks.
            4. # DATA INSIGHTS: Provide ONE (1) \`\`\`chartjs block.
            5. # MASTERCLASS CHEAT SHEET: Final glossary.
          `
        }
      ]
    });

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[GPT] Notes generated in ${duration}s`);
    return response.choices[0].message.content;
  } catch (err) {
    console.error("[GPT ERROR]", err);
    return null;
  }
}

