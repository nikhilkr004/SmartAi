import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";
import path from "path";
import { safeUnlink } from "../utils/fileHelper.js";
import { extractAudio } from "../utils/visualHelper.js";

// --- Gemini Configuration (Transcription & Backup) ---
function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("[GEMINI] API Key not found.");
    return null;
  }
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY || "");

export async function transcribeWithGemini(audioPath) {
  const genAI = getGeminiClient();
  if (!genAI) {
    throw new Error("Gemini API Key missing. Required for reliable transcription.");
  }

  console.log(`[GEMINI] Transcribing ${audioPath} with 1.5 Flash...`);
  const startTime = Date.now();

  try {
    // 1. Upload to Gemini File API
    const uploadResult = await fileManager.uploadFile(audioPath, {
      mimeType: audioPath.endsWith(".mp4") ? "video/mp4" : "audio/mpeg",
      displayName: path.basename(audioPath),
    });

    const fileUri = uploadResult.file.uri;
    console.log(`[GEMINI] File uploaded: ${fileUri}`);

    // 2. Transcribe
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadResult.file.mimeType,
          fileUri: fileUri,
        },
      },
      { text: "Accurately transcribe the audio content of this file. Return only the transcript text." },
    ]);

    const transcript = result.response.text();
    const duration = (Date.now() - startTime) / 1000;
    console.log(`[GEMINI] Transcription complete in ${duration}s`);
    
    return transcript;
  } catch (err) {
    console.error("[GEMINI ERROR]", err);
    throw new Error(`Gemini Transcription failed: ${err.message}`);
  }
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

    if (sizeInMB > 20) {
      console.log(`[OPENAI] File size (${sizeInMB.toFixed(1)}MB) is near limit. Compressing...`);
      processingPath = await extractAudio(audioPath);
      isTempFile = true;
      console.log(`[OPENAI] Compressed to ${(fs.statSync(processingPath).size / (1024 * 1024)).toFixed(1)}MB`);
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
    
    if (isNetworkError && retryCount < 5) {
      console.warn(`[OPENAI RETRY] Connection issue (${err.code || err.cause?.code || err.status}). Retrying in 5s (Attempt ${retryCount + 1}/5)...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
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

