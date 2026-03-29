import os
from fastapi import FastAPI, Request, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
from controllers.process_controller import process_audio_background
from services.firebase_service import update_job_status
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Smart AI Classroom Assistant - Python Backend")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProcessRequest(BaseModel):
    fileUrl: str
    jobId: str
    topic: Optional[str] = "Class Session"
    contentType: Optional[str] = "General"
    userId: str

@app.get("/")
async def health_check():
    return {"status": "online", "engine": "FastAPI/Python", "ai": "Gemini-2.5-Flash/Pro"}

@app.post("/process")
async def start_process(req: ProcessRequest, background_tasks: BackgroundTasks):
    """
    Immediate response endpoint that kicks off background AI processing.
    """
    print(f"[API] Received process request for Job: {req.jobId}")
    
    # Initialize job in Firestore
    update_job_status(req.jobId, {
        "status": "accepted",
        "topic": req.topic,
        "createdAt": None # Will be set by server timestamp in service
    })

    # Start background worker
    background_tasks.add_task(
        process_audio_background, 
        req.jobId, 
        req.fileUrl, 
        req.userId, 
        req.contentType, 
        req.topic
    )

    return {
        "success": True, 
        "message": "Processing started in background.", 
        "jobId": req.jobId
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
