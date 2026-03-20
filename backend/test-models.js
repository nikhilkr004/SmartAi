import dotenv from "dotenv";
dotenv.config();

async function listModels() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    if (data && data.models) {
      console.log(data.models.map(m => m.name).join("\n"));
    } else {
      console.log("No models array found:", JSON.stringify(data));
    }
  } catch(e) {
    console.error("Error fetching models:", e);
  }
}
listModels();
