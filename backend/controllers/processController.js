import { transcribeAudio, generateStructuredNotes } from "../services/aiService.js";
import { createNotesPdf } from "../services/pdfService.js";
import { uploadPdfForUser } from "../services/firebaseService.js";
import { safeUnlink } from "../utils/fileHelper.js";

export async function processAudio(req, res, next) {
  let audioPath;
  let pdfPath;

  try {
    const { user_id: userId } = req.body || {};
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: { message: "`file` is required in multipart form-data" } });
    }
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: { message: "`user_id` is required" } });
    }

    audioPath = file.path;
    const transcript = await transcribeAudio(audioPath);
    const notes = await generateStructuredNotes(transcript);
    pdfPath = await createNotesPdf({ notes, transcript });
    const pdfUrl = await uploadPdfForUser({ userId, pdfPath });

    return res.json({
      transcript,
      notes,
      pdf_url: pdfUrl
    });
  } catch (err) {
    return next(err);
  } finally {
    await safeUnlink(audioPath);
    await safeUnlink(pdfPath);
  }
}

