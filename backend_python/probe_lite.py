import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY") or "AIzaSyARrH2QQSklCIFttNSuT_15c4Y_wnVeYU0"
genai.configure(api_key=api_key)

print(f"--- Probing 'Lite' Models for Key: {api_key[:10]}... ---")

models_to_test = [
    "gemini-2.0-flash-lite-preview-02-05",
    "gemini-2.0-flash-lite",
    "gemini-3.1-flash-lite-preview",
    "gemini-1.5-flash-latest"
]

for model_name in models_to_test:
    try:
        model = genai.GenerativeModel(model_name)
        print(f"OK: {model_name}")
    except Exception as e:
        print(f"FAIL: {model_name} -> {e}")
