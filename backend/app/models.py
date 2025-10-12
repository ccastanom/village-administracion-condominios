from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="resident")  # 'admin' | 'resident'
    is_active = Column(Boolean, default=True)

    units = relationship("Unit", back_populates="owner")

class Unit(Base):
    __tablename__ = "units"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)  # e.g., 'Torre A - 302'
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    area_m2 = Column(Float, default=0.0)

    owner = relationship("User", back_populates="units")

class Amenity(Base):
    __tablename__ = "amenities"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # e.g., 'Salón Social', 'Gimnasio'

class Reservation(Base):
    __tablename__ = "reservations"
    id = Column(Integer, primary_key=True, index=True)
    amenity_id = Column(Integer, ForeignKey("amenities.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    start_at = Column(DateTime, nullable=False)
    end_at = Column(DateTime, nullable=False)
    status = Column(String(20), default="pending")  # pending|approved|cancelled
    created_at = Column(DateTime, default=datetime.utcnow)

class MaintenanceTicket(Base):
    __tablename__ = "maintenance_tickets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)
    title = Column(String(120), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(20), default="open")  # open|in_progress|closed
    created_at = Column(DateTime, default=datetime.utcnow)

class VisitorLog(Base):
    __tablename__ = "visitors"
    id = Column(Integer, primary_key=True, index=True)
    resident_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    visitor_name = Column(String(120), nullable=False)
    id_number = Column(String(60), nullable=True)
    allowed_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, default="")

class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)
    amount = Column(Float, nullable=False)
    method = Column(String(30), default="card")  # mock method
    paid_at = Column(DateTime, default=datetime.utcnow)
    receipt = Column(String(120), nullable=True)  # mock receipt code
