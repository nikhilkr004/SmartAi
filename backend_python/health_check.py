import requests
import json

RENDER_URL = "https://smartai-93hc.onrender.com"

def check_backend():
    print(f"--- HEALTH CHECK FOR {RENDER_URL} ---")
    
    # 1. Check Root
    try:
        res = requests.get(f"{RENDER_URL}/", timeout=10)
        print(f"[ROOT] {res.status_code} - {res.text[:50]}")
    except Exception as e:
        print(f"[ROOT] FAIL: {e}")

    # 2. Check Process Endpoint (Should return 401/403 due to missing auth)
    # This verifies the route exists.
    try:
        res = requests.post(f"{RENDER_URL}/process", json={}, timeout=10)
        print(f"[PROCESS] {res.status_code} (Expected 401 or 403) - {res.text[:50]}")
    except Exception as e:
        print(f"[PROCESS] FAIL: {e}")

if __name__ == "__main__":
    check_backend()
