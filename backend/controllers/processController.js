import { transcribeAudio, generateStructuredNotes } from "../services/aiService.js";
import { createNotesPdf } from "../services/pdfService.js";
import { uploadPdfForUser, uploadRecordingForUser } from "../services/firebaseService.js";
import { safeUnlink } from "../utils/fileHelper.js";
import { generateMermaidImage } from "../utils/mermaidHelper.js";

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
    
    console.log("[PROCESS] Starting Whisper transcription...");
    const transcript = await transcribeAudio(audioPath);
    console.log("[PROCESS] Transcription complete.");

    console.log("[PROCESS] Generating structured notes with AI...");
    const { notes, mermaidCode } = await generateStructuredNotes(transcript);
    console.log("[PROCESS] Notes generated.");

    let diagramBuffer = null;
    if (mermaidCode) {
      console.log("[PROCESS] Visual Diagram Code found. Fetching rendering from QuickChart...");
      diagramBuffer = await generateMermaidImage(mermaidCode);
    }

    console.log("[PROCESS] Creating PDF...");
    pdfPath = await createNotesPdf({ notes, transcript, diagramBuffer });
    console.log(`[PROCESS] PDF created at: ${pdfPath}`);

    console.log("[PROCESS] Uploading PDF to Firebase Storage...");
    const pdfUrl = await uploadPdfForUser({ userId, pdfPath });
    console.log(`[PROCESS] PDF uploaded. URL: ${pdfUrl}`);

    console.log("[PROCESS] Processing complete. Sending response...");
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

