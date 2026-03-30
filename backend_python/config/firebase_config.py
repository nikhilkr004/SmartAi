import os
import firebase_admin
from firebase_admin import credentials, firestore, storage, auth

_app = None

def init_firebase():
    global _app
    if _app is None:
        cert_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
        if not cert_path:
            # Check relative to current working directory
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
        
        bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET")
        print(f"[FIREBASE] Initializing with cert_path: {cert_path}")
        
        try:
            _app = firebase_admin.get_app()
            print("[FIREBASE] Using existing app instance")
        except ValueError:
            if not cert_path or not os.path.exists(cert_path):
                print(f"[FIREBASE ERROR] Credentials file NOT FOUND at: {cert_path}")
                # Fallback to default credentials if path fails
                _app = firebase_admin.initialize_app(options={'storageBucket': bucket_name})
            else:
                cred = credentials.Certificate(cert_path)
                _app = firebase_admin.initialize_app(cred, {
                    'storageBucket': bucket_name
                })
            print(f"[FIREBASE] Successfully initialized for Project: {_app.project_id}")
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
