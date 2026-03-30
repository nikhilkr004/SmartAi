import os
from fastapi import FastAPI, Request, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
import uuid
from controllers.process_controller import process_audio_background
from services.firebase_service import update_job_status
from config.firebase_config import get_db, get_bucket, get_auth
from dotenv import load_dotenv

load_dotenv()
# Gemini initialization is now handled within services/ai_service.py using the modern SDK

app = FastAPI(title="Smart AI Classroom Assistant - Python Backend")
# Ensure uploads directory exists
os.makedirs("uploads", exist_ok=True)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProcessRequest(BaseModel):
    fileUrl: str
    jobId: Optional[str] = None
    topic: Optional[str] = "Class Session"
    contentType: Optional[str] = "General"
    userId: Optional[str] = None

@app.get("/")
async def health_check():
    return {"status": "online", "engine": "FastAPI/Python", "ai": "Gemini-2.0-Lite/3.1-Flash"}

@app.post("/process")
async def start_process(req: ProcessRequest, request: Request, background_tasks: BackgroundTasks):
    """
    Immediate response endpoint that kicks off background AI processing.
    """
    # 1. Resolve Job ID (generate if missing)
    job_id = req.jobId or str(uuid.uuid4())
    
    # 2. Resolve User ID (extract from token if missing in body)
    user_id = req.userId
    if not user_id:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                decoded_token = get_auth().verify_id_token(token)
                user_id = decoded_token['uid']
                print(f"[AUTH SUCCESS] Verified Token for User: {user_id}", flush=True)
            except Exception as e:
                error_msg = str(e)
                print(f"[AUTH ERROR] Token verification failed: {error_msg}")
                
                # Check for the common "missing project id" error
                if "project ID is required" in error_msg or "project_id" in error_msg.lower():
                    detail = (
                        "Invalid Auth Token: A project ID is required to access the auth service.\n"
                        "TROUBLESHOOTING:\n"
                        "1. On Render, ensure 'FIREBASE_CREDENTIALS_JSON' env var is set with the full service account JSON contents.\n"
                        "2. Ensure 'FIREBASE_PROJECT_ID' is set to 'new-e70d7'.\n"
                        "3. Check that 'FIREBASE_STORAGE_BUCKET' is set to 'new-e70d7.firebasestorage.app'."
                    )
                else:
                    detail = f"Invalid Auth Token: {error_msg}"
                    
                raise HTTPException(status_code=401, detail=detail)
        else:
            raise HTTPException(status_code=401, detail="Missing userId in body and no valid Bearer token")

    print(f"[API] Processing request for User: {user_id}, Job: {job_id}", flush=True)
    
    # Initialize job in Firestore
    update_job_status(job_id, {
        "status": "accepted",
        "userId": user_id,
        "topic": req.topic,
        "contentType": req.contentType,
        "createdAt": None 
    })

    # Start background worker
    background_tasks.add_task(
        process_audio_background, 
        job_id, 
        req.fileUrl, 
        user_id, 
        req.contentType, 
        req.topic
    )

    return {
        "success": True, 
        "message": "Processing started in background.", 
        "jobId": job_id
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
