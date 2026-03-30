import os
import time
from google import genai
from google.genai import types
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Global client for the new SDK
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Use the latest standardized model names for the new SDK
LITE_MODEL = "gemini-2.0-flash-lite"
FLASH_MODEL = "gemini-1.5-flash"

async def transcribe_with_gemini(audio_path: str) -> str:
    """
    Transcribes audio using Gemini 2.0 Flash Lite via the modern SDK.
    """
    print(f"[GEMINI] Transcribing {audio_path} via Modern SDK...", flush=True)
    start_time = time.time()
    
    try:
        # 1. Upload file
        # The new SDK handles mime_type detection automatically or via config
        uploaded_file = client.files.upload(file=audio_path)
        print(f"[GEMINI] File uploaded: {uploaded_file.name}. Monitoring status...", flush=True)

        # 2. Polling (Status in new SDK is 'ACTIVE' or 'PROCESSING')
        while uploaded_file.state == "PROCESSING":
            time.sleep(2)
            uploaded_file = client.files.get(name=uploaded_file.name)

        if uploaded_file.state != "ACTIVE":
            raise Exception(f"Gemini File API failed: {uploaded_file.state}")

        # 3. Generate Content with Fallback
        try:
            print(f"[GEMINI] Attempting transcription with: {LITE_MODEL}", flush=True)
            response = client.models.generate_content(
                model=LITE_MODEL,
                contents=[
                    "Accurately transcribe the audio content of this file. Return only the transcript text.",
                    uploaded_file
                ]
            )
        except Exception as lite_error:
            print(f"[GEMINI WARNING] {LITE_MODEL} failed, falling back to {FLASH_MODEL}...", flush=True)
            response = client.models.generate_content(
                model=FLASH_MODEL,
                contents=[
                    "Accurately transcribe the audio content of this file. Return only the transcript text.",
                    uploaded_file
                ]
            )

        duration = time.time() - start_time
        print(f"[GEMINI] Transcription complete in {duration:.2f}s", flush=True)
        return response.text
        
    except Exception as e:
        print(f"[GEMINI ERROR] {str(e)}", flush=True)
        raise e

async def generate_gemini_notes(transcript: str, content_type: str = "General", topic: Optional[str] = None) -> Optional[str]:
    """
    Generates study notes using Gemini 3.1 Live Preview / 2.0 Flash via the modern SDK.
    """
    print(f"[GEMINI] Generating notes for {topic or 'Unspecified'}...", flush=True)
    start_time = time.time()
    
    try:
        # Use the highly intelligent Live Preview / Flash model
        # 3.1 Live Preview was models/gemini-3.1-flash-live-preview
        # For the new SDK, we use gemini-2.0-flash or gemini-2.0-pro-exp if available
        model_name = "gemini-2.0-flash" 
        
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
        
        response = client.models.generate_content(
            model=model_name,
            contents=prompt
        )
        
        duration = time.time() - start_time
        print(f"[GEMINI NOTES] Generated in {duration:.2f}s", flush=True)
        return response.text
    except Exception as e:
        print(f"[GEMINI NOTES ERROR] {str(e)}", flush=True)
        return None
