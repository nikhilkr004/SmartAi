import { transcribeAudio, generateStructuredNotes, deleteGeminiFile } from "../services/aiService.js";
import { createNotesPdf } from "../services/pdfService.js";
import { uploadPdfForUser, uploadRecordingForUser } from "../services/firebaseService.js";
import { safeUnlink } from "../utils/fileHelper.js";
import { generateD2Image, generateMermaidImage } from "../utils/mermaidHelper.js";
import { extractMultipleFrames } from "../utils/visualHelper.js";

export async function processAudio(req, res, next) {
  let audioPath;
  let pdfPath;

  try {
    const userId = req.user.uid;
    const file = req.file;

    console.log(`[PROCESS] Starting processing for User: ${userId}`);

    if (!file) {
      console.error("[PROCESS] No file received in request");
      return res.status(400).json({ error: { message: "`file` is required in multipart form-data" } });
    }

    audioPath = file.path;
    console.log(`[PROCESS] File received: ${file.originalname} -> ${audioPath} (${file.size} bytes)`);

    // Upload recording to Firebase Storage before it gets deleted.
    console.log("[PROCESS] Uploading original recording to Firebase Storage...");
    const videoUrl = await uploadRecordingForUser({ userId, recordingPath: audioPath });
    console.log(`[PROCESS] Recording uploaded. URL: ${videoUrl}`);
    
    console.log("[PROCESS] Starting Multi-model Analysis...");
    const { 
      transcript, 
      videoFileData, 
      geminiFileName 
    } = await transcribeAudio(audioPath);
    console.log("[PROCESS] Transcription complete.");

    console.log("[PROCESS] Generating structured notes and identifying visual moments...");
    const { 
      notes, 
      mermaidCode, 
      visualTimestamps 
    } = await generateStructuredNotes(transcript, videoFileData);
    
    // Clean up Gemini file early once AI is done with it
    if (geminiFileName) await deleteGeminiFile(geminiFileName);

    const diagramBuffers = [];
    // Priority 1: D2 blocks
    const d2Regex = /```d2\s*([\s\S]*?)```/g;
    while ((match = d2Regex.exec(notes)) !== null) {
      const code = match[1].trim();
      if (code) {
        const buffer = await generateD2Image(code);
        if (buffer) diagramBuffers.push(buffer);
      }
    }
    // Priority 2: Mermaid fallback blocks
    const mermaidRegex = /```mermaid\s*([\s\S]*?)```/g;
    while ((match = mermaidRegex.exec(notes)) !== null) {
      const code = match[1].trim();
      if (code) {
        const buffer = await generateMermaidImage(code);
        if (buffer) diagramBuffers.push(buffer);
      }
    }

    let visualImagePaths = [];
    if (visualTimestamps && visualTimestamps.length > 0) {
      console.log(`[PROCESS] AI identified ${visualTimestamps.length} key visual moments. Extracting screenshots...`);
      visualImagePaths = await extractMultipleFrames(audioPath, visualTimestamps);
    }

    console.log("[PROCESS] Creating Modern PDF...");
    pdfPath = await createNotesPdf({ 
      notes, 
      transcript, 
      diagramBuffers, 
      visualImagePaths 
    });
    console.log(`[PROCESS] PDF created at: ${pdfPath}`);

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

