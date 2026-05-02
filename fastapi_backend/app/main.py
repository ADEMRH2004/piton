from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi_pagination import add_pagination
from sqlalchemy import func, text
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import Any, Dict, Optional
import time
import uuid
from .schemas import UserCreate, UserRead, UserUpdate
from .users import auth_backend, fastapi_users, AUTH_URL_PATH
from fastapi.middleware.cors import CORSMiddleware
from .utils import simple_generate_unique_route_id
from app.routes.items import router as items_router
from app.routes.locations import router as locations_router
from app.config import settings
from app.database import engine, async_session_maker, create_db_and_tables
from app.models import Location

app = FastAPI(
    generate_unique_id_function=simple_generate_unique_route_id,
    openapi_url=settings.OPENAPI_URL,
)

# Middleware for CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include authentication and user management routes
app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix=f"/{AUTH_URL_PATH}/jwt",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix=f"/{AUTH_URL_PATH}",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_reset_password_router(),
    prefix=f"/{AUTH_URL_PATH}",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix=f"/{AUTH_URL_PATH}",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

# Include items and location routes
app.include_router(items_router, prefix="/items")
app.include_router(locations_router, prefix="/locations")


@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    await create_db_and_tables()
    await seed_sample_locations()


async def seed_sample_locations() -> None:
    async with async_session_maker() as session:
        count = await session.scalar(select(func.count(Location.id)))
        if count:
            return

        sample_locations = [
            Location(
                name="Central Park",
                description="New York City's most famous park.",
                latitude=40.785091,
                longitude=-73.968285,
            ),
            Location(
                name="Golden Gate Bridge",
                description="Iconic San Francisco landmark.",
                latitude=37.819929,
                longitude=-122.478255,
            ),
            Location(
                name="Kensington Gardens",
                description="Historic London park near Kensington Palace.",
                latitude=51.507398,
                longitude=-0.182106,
            ),
        ]

        session.add_all(sample_locations)
        await session.commit()

class JobRequest(BaseModel):
    perimeter_polygon: Dict[str, Any]
    date: Optional[str] = "2024-05-15"

# In-memory job storage for demo purposes
jobs_db: Dict[str, Dict[str, Any]] = {}


def process_job_pipeline(job_id: str, request: JobRequest) -> None:
    """Placeholder for the ML pipeline."""
    time.sleep(2)
    geom = request.perimeter_polygon.get("geometry", {})
    mock_feature = {
        "type": "Feature",
        "properties": {"system": "extensive"},
        "geometry": geom,
    }

    jobs_db[job_id]["status"] = "done"
    jobs_db[job_id]["results"] = {
        "message": "data arrived",
        "received_polygon": request.perimeter_polygon,
        "olive_groves": {
            "type": "FeatureCollection",
            "features": [mock_feature],
        },
        "stats": {
            "total": 1,
            "total_surface_ha": 42.0,
            "breakdown": {"extensive": 1, "intensive": 0, "hyper-intensive": 0},
        },
    }


@app.post("/api/cartographier")
async def create_job(request: JobRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    jobs_db[job_id] = {
        "id": job_id,
        "status": "pending",
        "request": request.model_dump(),
        "results": None,
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
            "received_polygon": results.get("received_polygon", {}),
        }
    return {"status": job["status"]}


@app.get("/api/export/{job_id}")
async def export_job(job_id: str):
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs_db[job_id].get("results", {}).get("export_geojson", {})


add_pagination(app)
