import { createNotesPdf } from "../services/pdfService.js";
import { uploadPdfForUser, uploadRecordingForUser, updateJobStatus, downloadFileFromStorage } from "../services/firebaseService.js";
import { safeUnlink } from "../utils/fileHelper.js";
import { generateD2Image, generateMermaidImage } from "../utils/mermaidHelper.js";
import { extractMultipleFrames } from "../utils/visualHelper.js";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export async function processAudio(req, res, next) {
  let audioPath;
  const jobId = uuidv4();

  try {
    const userId = req.user.uid;
    const { fileUrl, contentType = "General", topic: providedTopic } = req.body;

    if (!fileUrl) {
      return res.status(400).json({ error: { message: "`fileUrl` (Firebase Storage path) is required" } });
    }

    // 1. Respond immediately with 202 Accepted
    res.status(202).json({ 
      status: "processing", 
      jobId,
      message: "Processing started. Downloading from Storage..."
    });

    // 2. Start Background Processing
    (async () => {
      let pdfPath;
      try {
        await updateJobStatus(jobId, { status: "downloading", userId });

        // Define local path for processing
        const filename = path.basename(fileUrl);
        audioPath = path.join("uploads", `${jobId}-${filename}`);

        // Download from storage
        await downloadFileFromStorage(fileUrl, audioPath);

        await updateJobStatus(jobId, { status: "transcribing" });

        // --- STEP 1: TRANSCRIPTION ---
        let transcript;
        const { transcribeWithGemini, transcribeWithWhisper } = await import("../services/aiService.js");
        try {
          transcript = await transcribeWithGemini(audioPath);
        } catch (err) {
          console.warn("[BG-PROCESS] Gemini failed, falling back to Whisper...");
          transcript = await transcribeWithWhisper(audioPath);
        }

        await updateJobStatus(jobId, { status: "generating_notes", transcript });

        // --- STEP 2: NOTES ---
        const { generateGeminiNotes } = await import("../services/aiService.js");
        const finalNotes = await generateGeminiNotes(transcript, contentType, providedTopic);

        if (!finalNotes) throw new Error("Gemini Note generation failed.");

        await updateJobStatus(jobId, { status: "finalizing" });

        // --- STEP 3: UPLOAD & PDF ---
        const videoUrlPromise = uploadRecordingForUser({ userId, recordingPath: audioPath });
        
        const diagramTasks = [];
        const chartTasks = [];
        const mermaidRegex = /```mermaid\s*([\s\S]*?)```/g;
        let match;
        while ((match = mermaidRegex.exec(finalNotes)) !== null) {
          const code = match[1].trim();
          if (code) diagramTasks.push(generateMermaidImage(code));
        }

        const { generateChartImage } = await import("../utils/chartHelper.js");
        const chartRegex = /```chartjs\s*([\s\S]*?)```/g;
        while ((match = chartRegex.exec(finalNotes)) !== null) {
          try {
            const config = JSON.parse(match[1].trim());
            chartTasks.push(generateChartImage(config));
          } catch (e) {}
        }

        const diagramBuffers = (await Promise.all(diagramTasks)).filter(b => b);
        const chartBuffers = (await Promise.all(chartTasks)).filter(b => b);

        const topicMatch = finalNotes.match(/# (.*)/) || finalNotes.match(/\*\*(.*)\*\*/);
        const lectureTopic = topicMatch ? topicMatch[1] : "Class Session";

        pdfPath = await createNotesPdf({ 
          notes: finalNotes, transcript, diagramBuffers, chartBuffers,
          visualImagePaths: [], topic: providedTopic || lectureTopic, 
          isPro: false, userName: "Student"
        });

        const pdfUrl = await uploadPdfForUser({ userId, pdfPath });
        const videoUrl = await videoUrlPromise;

        // SUCCESS: Final Update
        await updateJobStatus(jobId, {
          status: "success",
          notes: finalNotes,
          pdfUrl,
          videoUrl,
          transcript
        });

      } catch (bgErr) {
        console.error("[BG-PROCESS ERROR]", bgErr);
        await updateJobStatus(jobId, { status: "error", error: bgErr.message });
      } finally {
        if (audioPath) await safeUnlink(audioPath);
        if (pdfPath) await safeUnlink(pdfPath);
      }
    })();

  } catch (err) {
    console.error("[PROCESS INITIATION ERROR]", err);
    return next(err);
  }
}
