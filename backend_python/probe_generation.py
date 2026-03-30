import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

async def test_payloads():
    key = os.getenv("GEMINI_API_KEY")
    models_to_test = ["gemini-1.5-flash", "gemini-2.0-flash-lite-preview-02-05"]
    versions = ["v1", "v1beta"]

    for ver in versions:
        print(f"\n=== TESTING {ver} ===")
        client = genai.Client(api_key=key, http_options={'api_version': ver})
        
        for model in models_to_test:
            print(f"  Trying {model}...")
            try:
                # Basic text test
                res = client.models.generate_content(model=model, contents="Hi")
                print(f"    [TEXT OK]")
            except Exception as e:
                print(f"    [TEXT FAIL] {str(e)[:100]}")

            # Note: We can't easily test file URI without a real upload here,
            # but we can check if the model is even recognized.

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_payloads())
