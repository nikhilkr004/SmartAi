import { transcribeAudio, generateStructuredNotes } from "../services/aiService.js";
import { createNotesPdf } from "../services/pdfService.js";
import { uploadPdfForUser } from "../services/firebaseService.js";
import { safeUnlink } from "../utils/fileHelper.js";

export async function processAudio(req, res, next) {
  let audioPath;
  let pdfPath;

  try {
    const userId = req.user.uid;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: { message: "`file` is required in multipart form-data" } });
    }

    audioPath = file.path;
    // Upload recording to Firebase Storage before it gets deleted.
    const videoUrl = await uploadRecordingForUser({ userId, recordingPath: audioPath });
    
    const transcript = await transcribeAudio(audioPath);
    const notes = await generateStructuredNotes(transcript);
    pdfPath = await createNotesPdf({ notes, transcript });
    const pdfUrl = await uploadPdfForUser({ userId, pdfPath });

    return res.json({
      transcript,
      notes,
      pdf_url: pdfUrl,
      video_url: videoUrl
    });
  } catch (err) {
    return next(err);
  } finally {
    await safeUnlink(audioPath);
    await safeUnlink(pdfPath);
  }
}

