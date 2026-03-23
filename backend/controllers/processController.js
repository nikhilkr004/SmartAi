import { transcribeAudio, generateStructuredNotes, deleteGeminiFile } from "../services/aiService.js";
import { createNotesPdf } from "../services/pdfService.js";
import { uploadPdfForUser, uploadRecordingForUser } from "../services/firebaseService.js";
import { safeUnlink } from "../utils/fileHelper.js";
import { generateD2Image, generateMermaidImage } from "../utils/mermaidHelper.js";
import { extractMultipleFrames } from "../utils/visualHelper.js";
import fs from "fs";

export async function processAudio(req, res, next) {
  let audioPath;
  let pdfPath;

  try {
    const userId = req.user.uid;
    const file = req.file;
    const { contentType = "General", topic: providedTopic } = req.body;

    const { getUserData, getUserRecordingCount } = await import("../services/firebaseService.js");
    const userData = await getUserData(userId);
    const planType = userData?.planType || "free";
    
    if (planType === "free") {
      const count = await getUserRecordingCount(userId);
      if (count >= 5) {
        console.warn(`[PROCESS] User ${userId} hit 5-PDF limit.`);
        return res.status(403).json({ 
          error: { message: "Free plan limit reached (5 PDFs). Please upgrade to Aero Pro for unlimited access." } 
        });
      }
    }

    console.log(`[PROCESS] Starting processing for User: ${userId} | Type: ${contentType} | Topic: ${providedTopic || 'None'}`);

    if (!file) {
      console.error("[PROCESS] No file received in request");
      return res.status(400).json({ error: { message: "`file` is required in multipart form-data" } });
    }

    audioPath = file.path;
    console.log(`[PROCESS] File received: ${file.originalname} -> ${audioPath} (${file.size} bytes)`);

    console.log("[PROCESS] Starting Parallel Operations: Firebase Upload & Gemini Transcription...");
    const startTime = Date.now();

    // Parallelize the two heaviest network operations
    const [videoUrl, transcriptionResult] = await Promise.all([
      uploadRecordingForUser({ userId, recordingPath: audioPath }),
      transcribeAudio(audioPath)
    ]);

    const { 
      transcript, 
      videoFileData, 
      geminiFileName 
    } = transcriptionResult;

    console.log(`[PROCESS] Parallel operations complete in ${((Date.now() - startTime)/1000).toFixed(1)}s.`);
    console.log(`[PROCESS] Recording URL: ${videoUrl}`);
    console.log("[PROCESS] Transcription complete.");

    console.log("[PROCESS] Generating structured notes and identifying visual moments...");
    const { 
      notes, 
      visualTimestamps 
    } = await generateStructuredNotes(transcript, videoFileData, contentType, providedTopic);
    
    // Clean up Gemini file early once AI is done with it
    if (geminiFileName) await deleteGeminiFile(geminiFileName);

    const diagramBuffers = [];
    const chartBuffers = [];
    let match;

    // 1. Extract Mermaid blocks for logic/flow diagrams
    const mermaidRegex = /```mermaid\s*([\s\S]*?)```/g;
    while ((match = mermaidRegex.exec(notes)) !== null) {
      const code = match[1].trim();
      if (code) {
        const buffer = await generateMermaidImage(code);
        if (buffer) diagramBuffers.push(buffer);
      }
    }

    // 2. Extract Chart.js blocks for data/stats
    const { generateChartImage } = await import("../utils/chartHelper.js");
    const chartRegex = /```chartjs\s*([\s\S]*?)```/g;
    while ((match = chartRegex.exec(notes)) !== null) {
      try {
        const configStr = match[1].trim();
        let config;
        try {
          config = JSON.parse(configStr);
        } catch (parseError) {
          console.warn("[PROCESS] Failed to parse Chart.js block (Likely invalid JSON):", parseError.message);
        }
        
        const buffer = await generateChartImage(config);
        if (buffer) chartBuffers.push(buffer);
      } catch (e) {
        console.warn("[PROCESS] Failed to parse Chart.js block:", e.message);
      }
    }

    console.log(`[PROCESS] Extraction complete. Diagrams: ${diagramBuffers.length}, Charts: ${chartBuffers.length}`);

    // Screen moments extraction removed as per user request for more diagrams/hints instead.
    const visualImagePaths = [];

    console.log("[PROCESS] Creating Modern PDF...");
    // Extraction: Find the first line or heading to use as the PDF topic cover
    const topicMatch = notes.match(/# (.*)/) || notes.match(/\*\*(.*)\*\*/);
    const lectureTopic = topicMatch ? topicMatch[1] : "Class Session";

    pdfPath = await createNotesPdf({ 
      notes, 
      transcript, 
      diagramBuffers, 
      chartBuffers, 
      visualImagePaths,
      topic: providedTopic || lectureTopic,
      isPro: planType === "pro"
    });
    console.log(`[PROCESS] PDF Created! Size: ${fs.statSync(pdfPath).size} bytes`);

    console.log("[PROCESS] Uploading PDF to Firebase Storage...");
    const pdfUrl = await uploadPdfForUser({ userId, pdfPath });

    // Cleanup screenshots after PDF is done
    for (const img of visualImagePaths) {
       await safeUnlink(img);
    }

    console.log("[PROCESS] Processing complete.");
    return res.json({
      transcript,
      notes,
      pdf_url: pdfUrl,
      video_url: videoUrl
    });
  } catch (err) {
    console.error("[PROCESS ERROR]", err);
    return next(err);
  } finally {
    if (audioPath) await safeUnlink(audioPath);
    if (pdfPath) await safeUnlink(pdfPath);
  }
}

