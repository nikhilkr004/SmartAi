import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { transcribeAudio, generateStructuredNotes } from './services/aiService.js';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function verify() {
  console.log("Starting Verification...");
  try {
    const dummyAudioPath = path.join(__dirname, 'test-audio.mp3');
    fs.writeFileSync(dummyAudioPath, "DUMMY AUDIO CONTENT for test");

    console.log("--- Testing Notes Generation ---");
    const testTranscript = "Hello class. Today we will discuss Newton's laws of motion. First, an object at rest stays at rest unless acted on by a force.";
    console.log(`Input: ${testTranscript}`);
    const { notes, mermaidCode, visualTimestamps } = await generateStructuredNotes(testTranscript);
    console.log(`\nGenerated Notes:\n${notes}\n`);
    console.log(`Mermaid Flowchart: ${mermaidCode ? "Generated" : "None"}`);
    console.log(`Visual Timestamps: ${visualTimestamps.join(", ") || "None"}`);

    console.log("--- Testing Audio Upload (Syntax and API reachability) ---");
    try {
      await transcribeAudio(dummyAudioPath);
    } catch(e) {
      // The dummy audio file format is likely invalid for the model to truly process,
      // but we should at least see if it uploads successfully and reaches the model call.
      console.log(`Transcribe attempt complete. Resulting error (expected if audio format invalid): ${e.message}`);
    }

    if (fs.existsSync(dummyAudioPath)) {
      fs.unlinkSync(dummyAudioPath);
    }

    console.log("Verification checks finished!");
  } catch (error) {
    console.error("Verification failed:", error);
  }
}

verify();
