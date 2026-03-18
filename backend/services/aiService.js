import fs from "fs";
import OpenAI from "openai";

function requireOpenAiKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw Object.assign(new Error("OPENAI_API_KEY is not set"), { statusCode: 500 });
  }
}

function getClient() {
  requireOpenAiKey();
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function transcribeAudio(audioPath) {
  try {
    const client = getClient();

    const resp = await client.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1"
    });

    const text = resp?.text?.trim();
    if (!text) {
      throw Object.assign(new Error("Transcription returned empty text"), { statusCode: 502 });
    }
    return text;
  } catch (err) {
    throw Object.assign(new Error(`OpenAI Whisper error: ${err.message}`), { statusCode: err.statusCode || 502 });
  }
}

export async function generateStructuredNotes(transcript) {
  try {
    const client = getClient();

    const prompt = [
      "You are an AI-powered Smart Classroom Assistant.",
      "Transform the transcript into structured classroom notes.",
      "",
      "Return notes as plain text using clear headings and bullet points.",
      "Include:",
      "- Title",
      "- Key concepts",
      "- Definitions",
      "- Examples (if any)",
      "- Action items / homework",
      "- 5-question quiz (with answers)",
      "",
      "Transcript:",
      transcript
    ].join("\n");

    const resp = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "You write helpful, accurate, structured notes for classroom learning." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3
    });

    const notes = resp?.choices?.[0]?.message?.content?.trim();
    if (!notes) {
      throw Object.assign(new Error("GPT returned empty notes"), { statusCode: 502 });
    }
    return notes;
  } catch (err) {
    throw Object.assign(new Error(`OpenAI GPT error: ${err.message}`), { statusCode: err.statusCode || 502 });
  }
}

