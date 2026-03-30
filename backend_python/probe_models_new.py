import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

print(f"--- Probing Models for Key: {api_key[:10]}... (Modern SDK) ---")
try:
    # In the new SDK, models are listed via client.models.list()
    for m in client.models.list():
        print(f"MODEL: {m.name} | METHODS: {m.supported_generation_methods}")
except Exception as e:
    print(f"ERROR: {e}")
