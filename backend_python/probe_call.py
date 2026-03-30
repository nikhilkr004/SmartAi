import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY") or "AIzaSyCRoEhu9PSDdpbZwL_igHbxUV36DNFKM0Y"
genai.configure(api_key=api_key)

print(f"--- Calling Models for Key: {api_key[:10]}... ---")

models_to_test = [
    "gemini-1.5-flash-latest",
    "gemini-1.0-pro"
]

for model_name in models_to_test:
    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content("Hi")
        print(f"OK: {model_name} -> {response.text[:10]}")
    except Exception as e:
        print(f"FAIL: {model_name} -> {e}")
