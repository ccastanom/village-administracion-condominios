from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List

# ---------- AUTH ----------
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "resident"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool
    class Config:
        from_attributes = True

# ---------- CORE ----------
class UnitIn(BaseModel):
    code: str
    owner_id: Optional[int] = None
    area_m2: float = 0.0

class UnitOut(UnitIn):
    id: int
    class Config:
        from_attributes = True

class AmenityIn(BaseModel):
    name: str

class AmenityOut(AmenityIn):
    id: int
    class Config:
        from_attributes = True

class ReservationIn(BaseModel):
    amenity_id: int
    user_id: int
    start_at: datetime
    end_at: datetime

class ReservationOut(ReservationIn):
    id: int
    status: str
    class Config:
        from_attributes = True

class TicketIn(BaseModel):
    user_id: int
    unit_id: Optional[int] = None
    title: str
    description: str

class TicketOut(TicketIn):
    id: int
    status: str
    class Config:
        from_attributes = True

class VisitorIn(BaseModel):
    resident_id: int
    visitor_name: str
    id_number: Optional[str] = None
    notes: Optional[str] = ""

class VisitorOut(VisitorIn):
    id: int
    allowed_at: datetime
    class Config:
        from_attributes = True

class PaymentIn(BaseModel):
    user_id: int
    unit_id: Optional[int] = None
    amount: float
    method: str = "card"

class PaymentOut(PaymentIn):
    id: int
    paid_at: datetime
    receipt: Optional[str] = None
    class Config:
        from_attributes = True
