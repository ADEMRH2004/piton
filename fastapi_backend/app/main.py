from fastapi import FastAPI
from fastapi_pagination import add_pagination
from sqlalchemy import func, text
from sqlalchemy.future import select
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

add_pagination(app)
