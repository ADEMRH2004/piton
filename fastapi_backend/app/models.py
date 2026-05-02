from geoalchemy2 import Geometry
from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from sqlalchemy import Column, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship
from uuid import uuid4


class Base(DeclarativeBase):
    pass


class User(SQLAlchemyBaseUserTableUUID, Base):
    items = relationship("Item", back_populates="user", cascade="all, delete-orphan")


class Item(Base):
    __tablename__ = "items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    quantity = Column(Integer, nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False)

    user = relationship("User", back_populates="items")


class Location(Base):
    __tablename__ = "locations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    coordinates = Column(
        Geometry(geometry_type="POINT", srid=4326), nullable=False
    )

    def __init__(self, **kwargs):
        latitude = kwargs.get("latitude")
        longitude = kwargs.get("longitude")
        if latitude is not None and longitude is not None:
            kwargs["coordinates"] = f"SRID=4326;POINT({longitude} {latitude})"
        super().__init__(**kwargs)
