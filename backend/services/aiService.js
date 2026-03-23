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

export async function transcribeAudio(videoPath) {
  let uploadResult = null;
  let tempAudioPath = null;
  const fileManager = getFileManager();
  
  try {
    const stats = fs.statSync(videoPath);
    console.log(`[GEMINI] Original Video: ${videoPath} (${stats.size} bytes)`);

    // Extract audio to reduce upload size (69MB -> ~3MB)
    tempAudioPath = await extractAudio(videoPath);
    const audioStats = fs.statSync(tempAudioPath);
    console.log(`[GEMINI] Extracted Audio: ${tempAudioPath} (${audioStats.size} bytes)`);

    console.log(`[GEMINI] Starting file upload to Gemini...`);
    const startTime = Date.now();
    
    const mimeType = "audio/mp3";

    uploadResult = await fileManager.uploadFile(tempAudioPath, {
      mimeType: mimeType,
      displayName: path.basename(tempAudioPath),
    });
    
    console.log(`[GEMINI] Upload successful. URI: ${uploadResult.file.uri}. Waiting for processing...`);

    // Clean up local temp audio early
    await safeUnlink(tempAudioPath);
    tempAudioPath = null;

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

export async function generateStructuredNotes(transcript, videoFileData = null, contentType = "General", topic = null) {
  try {
    const client = getClient();
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

    const promptParts = [
      { text: "You are a World-Class Academic Tutor writing 'Masterclass' quality study notes for a student." },
      { text: `Below is a transcript from a classroom session: \n\n${transcript}` },
      { text: "Your goal: Create a high-value, structured guide that looks handmade and expert." },
      { text: `CONTEXT: The content type is ${contentType}${topic ? ` and the topic is ${topic}` : ""}.` },
      { text: "STRUCTURE REQUIREMENTS (Strictly follow this order):" },
      { text: "1. # EXECUTIVE SUMMARY: Exactly 3 punchy, high-impact bullet points summarizing the entire session." },
      { text: "2. # DEEP DIVE: Detailed breakdown of concepts. Use ## for sub-topics. Keep points short but deep." },
      { text: "3. SPECIAL CALLOUTS: Use these liberally throughout the DEEP DIVE: \n" +
              "   - [TIP: Pro-level shortcut or insight] \n" +
              "   - [DEF: Crucial term - Concise definition] \n" +
              "   - [HINT: Memory trick or deep connection] \n" +
              "   - [EX: Real-world scenario to apply the concept]" },
      { text: "4. # DIAGRAM FLOWS: You MUST include at least TWO (2) distinct diagrams in Mermaid notation. Use ```mermaid blocks. \n" +
              "   - ONLY use 'graph TD' flowcharts. \n" +
              "   - Use simple arrows '-->' and clear labels like: A[Concept] --> B[Result]. \n" +
              "   - CRITICAL: Do NOT use quotes INSIDE labels. Avoid A[\"Time: O(\"N\")\"] - instead use A[\"Time: O(N)\"]." },
      { text: "5. # DATA VISUALIZATION: If the transcript contains any numbers, comparisons, or progress data, you MUST include a Chart.js configuration block. Use ```chartjs blocks. \n" +
              "   - Provide a VALID JSON object for the Chart.js 'config'. \n" +
              "   - CRITICAL: Use DOUBLE QUOTES (\") for all keys and string values. Do NOT use single quotes (') for the JSON structure. \n" +
              "   - Example: { \"type\": \"bar\", \"data\": { \"labels\": [\"A\", \"B\"], \"datasets\": [{ \"label\": \"Sales\", \"data\": [10, 20] }] } } \n" +
              "   - Keep it simple but professional." },
      { text: "6. # MASTERCLASS CHEAT SHEET: A final 'Too Long; Didn't Read' summary or a glossary of formulas/key terms at the end." },
      { text: "CRITICAL RULES:" },
      { text: "- NO VERBOSITY: Use short sentences. MAX 5 bullet points per sub-topic. Focus on conceptual clarity." },
      { text: "- FORMATTING: Use bold text for key terms. Use bulleted lists for all details." },
      { text: "- VISUAL LAYOUT: Every major section MUST start with a '#' heading." },
      { text: "- CLEAN BLOCKS: Ensure ```mermaid and ```chartjs blocks start immediately after the heading, with NO extra leading or trailing whitespace inside the backticks." },
      { text: "- LANGUAGE: If 'Coding', provide structured code blocks in the detected language. Stick to one language only." }
    ];


    const result = await model.generateContent(promptParts);

    const text = result.response.text()?.trim();
    if (!text) {
      console.error("[GEMINI] Model returned empty notes.");
      throw Object.assign(new Error("Gemini returned empty notes"), { statusCode: 502 });
    }

    // Extraction logic: We leave Mermaid blocks IN the notes so the PDF can render them as text fallback 
    // OR the controller can find them. We'll let the controller do the extraction for buffers.
    let cleanNotes = text;
    let visualTimestamps = [];


    return { notes: cleanNotes };
  } catch (err) {
    console.error("[GEMINI GPT ERROR]", err);
    throw Object.assign(new Error(`Gemini notes error: ${err.message}`), { statusCode: 502 });
  }
}

