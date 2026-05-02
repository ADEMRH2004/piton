from fastapi import FastAPI, BackgroundTasks, HTTPException  # type: ignore[import]
from fastapi.middleware.cors import CORSMiddleware  # type: ignore[import]
from pydantic import BaseModel  # type: ignore[import]
from typing import Dict, Any, Optional
import uuid
import time

app = FastAPI(title="Hack The Harvest - Olive Grove AI")

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class JobRequest(BaseModel):
    perimeter_polygon: Dict[str, Any]
    date: Optional[str] = "2024-05-15"

# In-memory job storage for demo purposes
jobs_db = {}

def process_job_pipeline(job_id: str, request: JobRequest):
    """
    Placeholder for the ML pipeline. 
    """
    # Simulate pipeline processing time
    time.sleep(2)
    
    # Echo the drawn polygon back as a mock olive grove to prove the data arrived
    geom = request.perimeter_polygon.get("geometry", {})
    mock_feature = {
        "type": "Feature",
        "properties": {"system": "extensive"},
        "geometry": geom
    }

    jobs_db[job_id]["status"] = "done"
    jobs_db[job_id]["results"] = {
        "message": "data arrived",
        "received_polygon": request.perimeter_polygon,
        "olive_groves": {
            "type": "FeatureCollection",
            "features": [mock_feature]
        },
        "stats": {
            "total": 1,
            "total_surface_ha": 42.0,
            "breakdown": {"extensive": 1, "intensive": 0, "hyper-intensive": 0}
        }
    }

@app.post("/api/cartographier")
async def create_job(request: JobRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    jobs_db[job_id] = {
        "id": job_id,
        "status": "pending",
        "request": request.model_dump(),
        "results": None
    }
    background_tasks.add_task(process_job_pipeline, job_id, request)
    return {"job_id": job_id, "status": "processing"}

@app.get("/api/job/{job_id}")
async def get_job(job_id: str):
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs_db[job_id]
    if job["status"] == "done":
        results = job.get("results", {})
        return {
            "status": "done",
            "olive_groves": results.get("olive_groves", {}),
            "stats": results.get("stats", {}),
            "message": results.get("message", ""),
            "received_polygon": results.get("received_polygon", {})
        }
    return {"status": job["status"]}

@app.get("/api/export/{job_id}")
async def export_job(job_id: str):
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs_db[job_id].get("results", {}).get("export_geojson", {})

@app.put("/api/job/{job_id}/mock")
async def inject_mock_data(job_id: str, mock_data: Dict[str, Any]):
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    jobs_db[job_id]["status"] = "done"
    jobs_db[job_id]["results"] = mock_data
    return {"message": "Mock data injected successfully"}