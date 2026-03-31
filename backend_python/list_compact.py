import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("ERROR: GEMINI_API_KEY not found in environment.")
    exit(1)
genai.configure(api_key=api_key)

print(f"--- Model Keys for: {api_key[:10]}... ---")
try:
    for m in genai.list_models():
        print(f"{m.name}")
except Exception as e:
    print(f"ERROR: {e}")
