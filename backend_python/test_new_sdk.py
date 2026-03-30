import os
try:
    from google import genai
except ImportError:
    import google.genai as genai
    
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY") 
if not api_key:
    api_key = "AIzaSyARrH2QQSklCIFttNSuT_15c4Y_wnVeYU0"

print(f"--- Probing SDK with New Key: {api_key[:10]}... ---")

try:
    client = genai.Client(api_key=api_key)
    
    response = client.models.generate_content(
        model="gemini-2.0-flash-lite",
        contents="Say 'SDK WORKING'"
    )
    print(f"RESULT: {response.text}")
    print("SUCCESS: Full cycle with google-genai SDK completed.")

except Exception as e:
    print(f"FAIL: {e}")
