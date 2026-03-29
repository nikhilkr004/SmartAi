import os
import firebase_admin
from firebase_admin import credentials, firestore, storage, auth

_app = None

def init_firebase():
    global _app
    if _app is None:
        cert_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "backend_python/config/firebase-credentials.json")
        bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET")
        
        try:
            _app = firebase_admin.get_app()
        except ValueError:
            cred = credentials.Certificate(cert_path)
            _app = firebase_admin.initialize_app(cred, {
                'storageBucket': bucket_name
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
