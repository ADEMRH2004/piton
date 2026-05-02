import uuid

from fastapi_users import schemas
from pydantic import BaseModel
from uuid import UUID


class UserRead(schemas.BaseUser[uuid.UUID]):
    pass


class UserCreate(schemas.BaseUserCreate):
    pass


class UserUpdate(schemas.BaseUserUpdate):
    pass


class ItemBase(BaseModel):
    name: str
    description: str | None = None
    quantity: int | None = None


class ItemCreate(ItemBase):
    pass


class ItemRead(ItemBase):
    id: UUID
    user_id: UUID

    model_config = {"from_attributes": True}


class LocationBase(BaseModel):
    name: str
    description: str | None = None
    latitude: float
    longitude: float


class LocationCreate(LocationBase):
    pass


class LocationRead(LocationBase):
    id: UUID

    model_config = {"from_attributes": True}
