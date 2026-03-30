import os
import asyncio
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

async def quick_test():
    print("--- ⚡ QUICK AI HEALTH CHECK ---")
    client = genai.Client(
        api_key=os.getenv("GEMINI_API_KEY"),
        http_options={'api_version': 'v1'}
    )
    
    try:
        # Simple text test to verify API Key and Connectivity
        print("Testing Gemini connectivity...", flush=True)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents="Say 'AI is online' if you can read this."
        )
        print(f"RESULT: {response.text}")
        print("✅ Gemini API Connectivity: SUCCESS")
    except Exception as e:
        print(f"❌ Gemini API Connectivity: FAILED - {str(e)}")

if __name__ == "__main__":
    asyncio.run(quick_test())
