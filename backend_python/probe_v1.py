import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("ERROR: GEMINI_API_KEY not found in environment.")
    exit(1)

# Configure specifically for v1
from google.generativeai.types import RequestOptions
options = RequestOptions(api_version="v1")

genai.configure(api_key=api_key)

print(f"--- Calling Models (v1) for Key: {api_key[:10]}... ---")

models_to_test = [
    "gemini-1.5-flash",
    "gemini-1.0-pro"
]

for model_name in models_to_test:
    try:
        model = genai.GenerativeModel(model_name)
        # Try a direct call with v1
        response = model.generate_content("Hi", request_options=options)
        print(f"OK: {model_name} -> {response.text[:10]}")
    except Exception as e:
        print(f"FAIL: {model_name} -> {e}")
