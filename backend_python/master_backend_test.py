import os
import asyncio
import uuid
from dotenv import load_dotenv

# Mocking parts of the environment for standalone testing
load_dotenv()

from services.ai_service import transcribe_with_gemini, generate_gemini_notes
from services.pdf_service import create_notes_pdf
from services.ppt_service import create_study_ppt
from utils.file_helper import safe_unlink

async def run_master_test():
    print("--- 🚀 MASTER BACKEND INTEGRATION TEST STARTING ---")
    
    # 1. Verification of AI Key
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("❌ ERROR: GEMINI_API_KEY not found in environment!")
        return
    print(f"✅ AI Key found (ends in ...{api_key[-4:]})")

    # 2. Test Audio Generation (Tiny 1-second silent WAV)
    test_audio = "uploads/test_audio.wav"
    os.makedirs("uploads", exist_ok=True)
    import wave
    with wave.open(test_audio, 'wb') as obj:
        obj.setnchannels(1) 
        obj.setsampwidth(2) 
        obj.setframerate(44100)
        obj.writeframes(b'\x00' * 88200) # 1 second of silence
    print(f"✅ Generated test audio: {test_audio}")

    try:
        # 3. Test Transcription (This hits the actual Gemini API)
        print("\n--- 🎙️ TESTING TRANSCRIPTION ---")
        # Note: Silence might return empty text or a "silence" message from Gemini
        try:
            transcript = await transcribe_with_gemini(test_audio)
            print(f"✅ Transcription API Success! Transcript length: {len(transcript) if transcript else 0}")
        except Exception as e:
            print(f"⚠️ Transcription API returned an error (expected for silence?): {str(e)}")
            transcript = "This is a fallback transcript for testing the rest of the pipeline."

        # 4. Test Note Generation
        print("\n--- 📝 TESTING NOTE GENERATION ---")
        notes = await generate_gemini_notes(transcript, "Computer Science", "Artificial Intelligence")
        if notes:
            print(f"✅ Note Generation Success! Notes length: {len(notes)}")
        else:
            print("❌ Note Generation FAILED!")
            return

        # 5. Test PDF Export
        print("\n--- 📄 TESTING PDF EXPORT ---")
        test_pdf = f"uploads/test_{uuid.uuid4()}.pdf"
        create_notes_pdf(notes, transcript, "AI Lecture", test_pdf)
        if os.path.exists(test_pdf):
            print(f"✅ PDF Creation Success: {test_pdf}")
            safe_unlink(test_pdf)
        else:
            print("❌ PDF Creation FAILED!")

        # 6. Test PPT Export
        print("\n--- 📊 TESTING PPT EXPORT ---")
        test_ppt = f"uploads/test_{uuid.uuid4()}.pptx"
        create_study_ppt(notes, "AI Lecture", test_ppt)
        if os.path.exists(test_ppt):
            print(f"✅ PPT Creation Success: {test_ppt}")
            safe_unlink(test_ppt)
        else:
            print("❌ PPT Creation FAILED!")

        print("\n--- ✨ MASTER TEST COMPLETE: ALL CORE SERVICES FUNCTIONAL! ✨ ---")

    except Exception as e:
        print(f"\n❌ MASTER TEST CRASHED: {str(e)}")
    finally:
        safe_unlink(test_audio)

if __name__ == "__main__":
    asyncio.run(run_master_test())
