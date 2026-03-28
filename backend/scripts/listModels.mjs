import dotenv from "dotenv";

dotenv.config();

async function listModels() {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log("List Models Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

listModels();
