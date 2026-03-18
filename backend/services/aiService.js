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
      throw Object.assign(new Error("GPT returned empty notes"), { statusCode: 502 });
    }
    return notes;
  } catch (err) {
    throw Object.assign(new Error(`OpenAI GPT error: ${err.message}`), { statusCode: err.statusCode || 502 });
  }
}

