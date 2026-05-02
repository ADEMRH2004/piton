from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_async_session
from app.models import Location
from app.schemas import LocationRead

router = APIRouter(tags=["locations"])


@router.get("/", response_model=list[LocationRead])
async def read_locations(db: AsyncSession = Depends(get_async_session)):
    result = await db.execute(select(Location))
    return result.scalars().all()
