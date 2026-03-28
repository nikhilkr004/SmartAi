import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

async function verify() {
  const key = process.env.GEMINI_API_KEY;
  console.log("Testing Key:", key.substring(0, 10) + "...");
  
  const genAI = new GoogleGenerativeAI(key);
  const modelsToTest = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-2.5-flash"];
  
  for (const modelName of modelsToTest) {
    try {
      console.log(`Testing model: ${modelName} (v1)...`);
      const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: 'v1' });
      const result = await model.generateContent("Hi");
      console.log(`✅ ${modelName} Works! (v1) Response:`, result.response.text());
      return; 
    } catch (err) {
      console.error(`❌ ${modelName} Failed (v1):`, err.message);
    }
  }
}

verify();
