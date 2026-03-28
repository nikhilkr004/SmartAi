import dotenv from "dotenv";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

dotenv.config();

/**
 * QUICK DIAGNOSTIC SCRIPT FOR GEMINI
 * Run this to verify your API Key and File API connectivity.
 */
async function diagnostic() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "your-gemini-api-key") {
    console.error("❌ ERROR: GEMINI_API_KEY is missing or using placeholder in .env");
    return;
  }

  console.log("✅ API Key detected. Testing connectivity...");

  try {
    const fileManager = new GoogleAIFileManager(key);
    const genAI = new GoogleGenerativeAI(key);

    // List recent files as a simple "ping"
    const listFilesResponse = await fileManager.listFiles();
    console.log("✅ Success! Gemini File API responded.");
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Hello, are you ready for transcription tasks?");
    console.log("✅ Success! Gemini Model responded:", result.response.text());

    console.log("\n🚀 EVERYTHING IS SET UP CORRECTLY FOR GEMINI!");
  } catch (err) {
    console.error("❌ DIAGNOSTIC FAILED:", err.message);
    console.log("\nTip: Ensure your key has 'Generative AI API' enabled in Google AI Studio.");
  }
}

diagnostic();
