import os
import json
import firebase_admin
from firebase_admin import credentials, firestore, storage, auth

_app = None

def init_firebase():
    global _app
    if _app is None:
        # 1. Try to load from raw JSON environment variable (Best for Render/Cloud)
        json_creds = os.getenv("FIREBASE_CREDENTIALS_JSON")
        bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET", "new-e70d7.firebasestorage.app")
        project_id = os.getenv("FIREBASE_PROJECT_ID", "new-e70d7")

        try:
            _app = firebase_admin.get_app()
            print("[FIREBASE] Using existing app instance")
            return _app
        except ValueError:
            pass

        if json_creds:
            try:
                print("[FIREBASE] Initializing from FIREBASE_CREDENTIALS_JSON...")
                cred_dict = json.loads(json_creds)
                cred = credentials.Certificate(cred_dict)
                _app = firebase_admin.initialize_app(cred, {
                    'storageBucket': bucket_name,
                    'projectId': project_id
                })
                print(f"[FIREBASE] Successfully initialized for Project: {_app.project_id}")
                return _app
            except Exception as e:
                print(f"[FIREBASE ERROR] Failed to parse FIREBASE_CREDENTIALS_JSON: {str(e)}")

        # 2. Fallback to physical file path
        cert_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
        if not cert_path:
            paths_to_check = [
                "config/firebase-credentials.json",
                "backend_python/config/firebase-credentials.json",
                os.path.join(os.getcwd(), "config/firebase-credentials.json"),
                os.path.join(os.getcwd(), "backend_python/config/firebase-credentials.json")
            ]
            for p in paths_to_check:
                if os.path.exists(p):
                    cert_path = p
                    break
        
        print(f"[FIREBASE] Initializing with cert_path: {cert_path}")
        
        if cert_path and os.path.exists(cert_path):
            cred = credentials.Certificate(cert_path)
            _app = firebase_admin.initialize_app(cred, {
                'storageBucket': bucket_name,
                'projectId': project_id
            })
            print(f"[FIREBASE] Successfully initialized for Project: {_app.project_id}")
        else:
            print(f"[FIREBASE ERROR] No credentials found (JSON or File). Path tried: {cert_path}")
            # Final fallback to default credentials (may fail without GOOGLE_APPLICATION_CREDENTIALS)
            _app = firebase_admin.initialize_app(options={
                'storageBucket': bucket_name,
                'projectId': project_id
            })
            
    return _app

def get_db():
    init_firebase()
    return firestore.client()

def get_bucket():
    init_firebase()
    return storage.bucket()

def get_auth():
    init_firebase()
    return auth
