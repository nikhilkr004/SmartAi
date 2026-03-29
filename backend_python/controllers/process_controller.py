import os
import uuid
import asyncio
from fastapi import BackgroundTasks
from services.ai_service import transcribe_with_gemini, transcribe_with_whisper, generate_gemini_notes
from services.firebase_service import update_job_status, download_file_from_storage, upload_file_to_storage
from services.pdf_service import create_notes_pdf
from services.ppt_service import create_study_ppt
from utils.file_helper import safe_unlink

async def process_audio_background(job_id: str, storage_url: str, user_id: str, content_type: str, topic: str):
    """
    The main background worker that handles the end-to-end AI pipeline.
    """
    local_audio = f"backend_python/uploads/{uuid.uuid4()}.mp3"
    local_pdf = f"backend_python/uploads/{uuid.uuid4()}.pdf"
    local_ppt = f"backend_python/uploads/{uuid.uuid4()}.pptx"
    
    try:
        # --- 1. DOWNLOAD ---
        update_job_status(job_id, {"status": "downloading", "progress": 10})
        download_file_from_storage(storage_url, local_audio)

        # --- 2. TRANSCRIBE ---
        update_job_status(job_id, {"status": "transcribing", "progress": 30})
        try:
            transcript = await transcribe_with_gemini(local_audio)
        except:
            print("[BG-PROCESS] Gemini failed, falling back to Whisper...")
            transcript = await transcribe_with_whisper(local_audio)

        if not transcript:
            raise Exception("Transcription failed on all providers.")

        # --- 3. GENERATE NOTES ---
        update_job_status(job_id, {"status": "generating_notes", "progress": 60, "transcript": transcript})
        notes = await generate_gemini_notes(transcript, content_type, topic)
        
        if not notes:
            raise Exception("Note generation failed.")

        # --- 4. EXPORT (PDF & PPT) ---
        update_job_status(job_id, {"status": "finalizing", "progress": 85})
        
        # Create PDF
        create_notes_pdf(notes, transcript, topic or "Lecture", local_pdf)
        pdf_url = upload_file_to_storage(local_pdf, f"users/{user_id}/notes/{job_id}.pdf", "application/pdf")

        # Create PPT
        create_study_ppt(notes, topic or "Lecture", local_ppt)
        ppt_url = upload_file_to_storage(local_ppt, f"users/{user_id}/presentations/{job_id}.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation")

        # --- 5. SUCCESS ---
        update_job_status(job_id, {
            "status": "success", 
            "progress": 100,
            "pdfUrl": pdf_url, 
            "pptUrl": ppt_url, 
            "notes": notes
        })

    except Exception as e:
        print(f"[BG-PROCESS ERROR] {str(e)}")
        update_job_status(job_id, {"status": "failed", "error": str(e)})
    finally:
        # Cleanup
        safe_unlink(local_audio)
        safe_unlink(local_pdf)
        safe_unlink(local_ppt)
