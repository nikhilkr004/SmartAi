import os
import time
import google.generativeai as genai
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

async def transcribe_with_gemini(audio_path: str) -> str:
    """
    Transcribes audio using Gemini 1.5 Flash.
    """
    print(f"[GEMINI] Transcribing {audio_path}...", flush=True)
    start_time = time.time()
    
    try:
        # 1. Upload file to Gemini
        # MIME type detection
        ext = Path(audio_path).suffix.lower()
        mime_type = "audio/mpeg"
        if ext == ".mp4": mime_type = "video/mp4"
        elif ext == ".wav": mime_type = "audio/wav"
        elif ext == ".m4a": mime_type = "audio/x-m4a"

        uploaded_file = genai.upload_file(path=audio_path, mime_type=mime_type)
        print(f"[GEMINI] File uploaded: {uploaded_file.uri}. Waiting for processing...", flush=True)

        # 2. Polling for completion
        while uploaded_file.state.name == "PROCESSING":
            time.sleep(2)
            uploaded_file = genai.get_file(uploaded_file.name)

        if uploaded_file.state.name != "ACTIVE":
            raise Exception(f"Gemini File API failed: {uploaded_file.state.name}")

        # 3. Generate Content
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        response = model.generate_content([
            uploaded_file,
            "Accurately transcribe the audio content of this file. Return only the transcript text."
        ])

        duration = time.time() - start_time
        print(f"[GEMINI] Transcription complete in {duration:.2f}s", flush=True)
        return response.text
        
    except Exception as e:
        print(f"[GEMINI ERROR] {str(e)}", flush=True)
        raise e

async def generate_gemini_notes(transcript: str, content_type: str = "General", topic: Optional[str] = None) -> Optional[str]:
    """
    Generates study notes using Gemini 1.5 Pro.
    """
    print(f"[GEMINI] Generating notes for {topic or 'Unspecified'}...", flush=True)
    start_time = time.time()
    
    try:
        model = genai.GenerativeModel("gemini-1.5-pro")
        
        prompt = f"""
        TRANSCRIPT:
        {transcript}

        TASK: Create a professional study guide based on this lecture.
        CONTEXT: {content_type}{f" | TOPIC: {topic}" if topic else ""}.

        STRUCTURE MUST BE:
        1. # EXECUTIVE SUMMARY: 3 punchy, high-impact points.
        2. # CONCEPTUAL DEEP DIVE: Use ## for each core concept. Include [TIP], [DEF], [HINT], and [EX] callouts.
        3. # VISUAL FLOWS: Provide exactly TWO (2) ```mermaid graph TD blocks explaining the logic.
        4. # DATA INSIGHTS: Provide ONE (1) ```chartjs block if any data exists.
        5. # MASTERCLASS CHEAT SHEET: A final glossary or formula list.

        STYLE: Use bold text for key terms. Keep points clear and professional. Avoid verbosity.
        """
        
        response = model.generate_content(prompt)
        
        duration = time.time() - start_time
        print(f"[GEMINI NOTES] Generated in {duration:.2f}s", flush=True)
        return response.text
    except Exception as e:
        print(f"[GEMINI NOTES ERROR] {str(e)}", flush=True)
        return None
