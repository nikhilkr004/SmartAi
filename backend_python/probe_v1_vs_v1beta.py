import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

def probe_versions():
    key = os.getenv("GEMINI_API_KEY")
    for ver in ['v1', 'v1beta']:
        print(f"\n--- PROBING {ver} ---")
        try:
            client = genai.Client(api_key=key, http_options={'api_version': ver})
            models = client.models.list()
            for m in models:
                if 'generateContent' in m.supported_generation_methods:
                    print(f"  [OK] {m.name}")
        except Exception as e:
            print(f"  [ERROR] {str(e)}")

if __name__ == "__main__":
    probe_versions()
