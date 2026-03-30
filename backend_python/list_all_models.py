import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY") or "AIzaSyCRoEhu9PSDdpbZwL_igHbxUV36DNFKM0Y"
genai.configure(api_key=api_key)

print(f"--- Full Model Listing for Key: {api_key[:10]}... ---")
try:
    for m in genai.list_models():
        print(f"MODEL: {m.name} | METHODS: {m.supported_generation_methods}")
except Exception as e:
    print(f"ERROR: {e}")
