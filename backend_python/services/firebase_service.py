import os
from datetime import datetime, timedelta
from config.firebase_config import get_db, get_bucket, init_firebase
from firebase_admin import firestore

def update_job_status(job_id: str, data: dict):
    """
    Updates the status of a processing job in Firestore.
    """
    try:
        db = get_db()
        data['updatedAt'] = firestore.SERVER_TIMESTAMP
        db.collection("processing_jobs").document(job_id).set(data, merge=True)
        print(f"[FIREBASE] Job {job_id} updated: {data.get('status')}")
    except Exception as e:
        print(f"[FIREBASE ERROR] Failed to update job {job_id}: {str(e)}")

import requests

def download_file_from_storage(storage_url: str, local_path: str):
    """
    Downloads a file from a URL (Firebase Storage signed/download URL) to a local path.
    """
    try:
        print(f"[FIREBASE] Downloading from URL: {storage_url[:50]}...", flush=True)
        response = requests.get(storage_url, stream=True, timeout=30)
        response.raise_for_status()
        
        with open(local_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                
        print(f"[FIREBASE] Download complete: {local_path}")
    except Exception as e:
        print(f"[FIREBASE ERROR] Download failed: {str(e)}")
        raise e

def upload_file_to_storage(local_path: str, destination_path: str, content_type: str) -> str:
    """
    Uploads a local file to Firebase Storage and returns a signed URL.
    """
    try:
        bucket = get_bucket()
        blob = bucket.blob(destination_path)
        blob.upload_from_filename(local_path, content_type=content_type)
        
        # Generate a long-lived signed URL
        url = blob.generate_signed_url(
            expiration=timedelta(days=3650), # ~10 years
            method='GET'
        )
        return url
    except Exception as e:
        print(f"[FIREBASE ERROR] Upload failed for {local_path}: {str(e)}")
        raise e

def get_user_data(user_id: str):
    try:
        db = get_db()
        doc = db.collection("users").document(user_id).get()
        return doc.to_dict() if doc.exists else None
    except Exception as e:
        print(f"[FIREBASE ERROR] Failed to get user data for {user_id}: {str(e)}")
        return None
