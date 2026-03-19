import fs from "fs";
import OpenAI from "openai";
import axios from "axios";
import FormData from "form-data";
import { safeUnlink } from "../utils/fileHelper.js";

function requireOpenAiKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw Object.assign(new Error("OPENAI_API_KEY is not set"), { statusCode: 500 });
  }
}

function getClient() {
  requireOpenAiKey();
  const key = process.env.OPENAI_API_KEY;
  console.log(`[AI SERVICE] Initializing with key prefix: ${key.substring(0, 7)}...`);
  return new OpenAI({
    apiKey: key,
    timeout: 300000 // 5 minutes
  });
}

export async function transcribeAudio(audioPath) {
  try {
    const stats = fs.statSync(audioPath);
    console.log(`[WHISPER] File: ${audioPath} (${stats.size} bytes)`);

    const formData = new FormData();
    formData.append("file", fs.createReadStream(audioPath));
    formData.append("model", "whisper-1");

    console.log(`[WHISPER] Starting axios upload to OpenAI...`);
    const startTime = Date.now();

    const response = await axios.post("https://api.openai.com/v1/audio/transcriptions", formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 300000 // 5 minutes
    });

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[WHISPER] Success! Took ${duration}s`);
    const text = response.data?.text?.trim();
    if (!text) {
      console.error("[WHISPER] Transcription returned empty text.");
      throw Object.assign(new Error("Transcription returned empty text"), { statusCode: 502 });
    }
    return text;
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    const errorCode = err.code || "N/A";
    const keyPrefix = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 7) : "NONE";

    console.error("[WHISPER ERROR DETAIL]", {
      status: err.response?.status,
      data: err.response?.data,
      code: errorCode,
      message: errorMsg
    });

    throw Object.assign(new Error(`OpenAI Whisper error: ${errorMsg} (Code: ${errorCode}) [Key: ${keyPrefix}...]`), {
      statusCode: err.response?.status || 502
    });
  }
}

export async function generateStructuredNotes(transcript) {
  try {
    const client = getClient();

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

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a master at taking notes from classroom lectures. You produce detailed, structured, and helpful student resources in the lecture's primary language." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3
    });

    const notes = resp?.choices?.[0]?.message?.content?.trim();
    if (!notes) {
      console.error("[GPT] Model returned empty notes.");
      throw Object.assign(new Error("GPT returned empty notes"), { statusCode: 502 });
    }
    return notes;
  } catch (err) {
    console.error("[GPT ERROR]", {
      message: err.message,
      code: err.code,
      type: err.type,
      status: err.status,
      data: err.response?.data
    });
    throw Object.assign(new Error(`OpenAI GPT error: ${err.message}`), { statusCode: err.statusCode || 502 });
  }
}

