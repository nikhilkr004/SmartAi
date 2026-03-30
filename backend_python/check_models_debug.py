import os
import google.generativeai as genai
from dotenv import load_dotenv

# Try to load .env if it exists
load_dotenv()

# Prioritize the key provided in the system context/user request
api_key = os.getenv("GEMINI_API_KEY") or "AIzaSyCRoEhu9PSDdpbZwL_igHbxUV36DNFKM0Y"
genai.configure(api_key=api_key)

print(f"--- Checking Models for Key: {api_key[:10]}... ---")
try:
    models = genai.list_models()
    found = False
    for m in models:
        if 'generateContent' in m.supported_generation_methods:
            print(f"AVAILABLE: {m.name}")
            found = True
    if not found:
        print("No models found with 'generateContent' support.")
except Exception as e:
    print(f"ERROR: {e}")
