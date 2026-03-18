import { downloadAudioFromUrl } from "../services/audioService.js";
import { transcribeAudio, generateStructuredNotes } from "../services/aiService.js";
import { createNotesPdf } from "../services/pdfService.js";
import { uploadPdfForUser } from "../services/firebaseService.js";
import { isValidHttpUrl, safeUnlink } from "../utils/fileHelper.js";

export async function processAudio(req, res, next) {
  let audioPath;
  let pdfPath;

  try {
    const { audio_url: audioUrl, user_id: userId } = req.body || {};

    if (!audioUrl || typeof audioUrl !== "string") {
      return res.status(400).json({ error: { message: "`audio_url` is required and must be a string" } });
    }
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: { message: "`user_id` is required and must be a string" } });
    }
    if (!isValidHttpUrl(audioUrl)) {
      return res.status(400).json({ error: { message: "Invalid `audio_url` (must be http/https)" } });
    }

    audioPath = await downloadAudioFromUrl(audioUrl);
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

