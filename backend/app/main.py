from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from typing import List
from pathlib import Path

from .database import Base, engine, get_db
from . import models, schemas
from .auth import hash_password, verify_password, create_access_token, get_current_user, require_role
from pydantic import BaseModel, EmailStr
from typing import Optional
# -------------------- APP & CORS & FRONTEND --------------------



# --- Modelo de actualización (para no tocar schemas.py) ---
class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

# 1) Crear la app primero
app = FastAPI(title="Village - Gestión de Condominios")

# 2) CORS (permite orígenes locales comunes)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500", "http://localhost:5500",  # Live Server
        "http://127.0.0.1:4200", "http://localhost:4200",  # Angular (si lo usas luego)
        "http://127.0.0.1:5173", "http://localhost:5173",  # python -m http.server
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],  # incluye Authorization
)

# 3) Montar el frontend en /app  (ruta: <raíz del repo>/frontend)
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
app.mount("/app", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="app")

@app.get("/", response_class=HTMLResponse)
def root():
    # Redirige al frontend
    return '<meta http-equiv="refresh" content="0; url=/app/index.html" />'

# 4) Crear tablas automáticamente en MySQL
Base.metadata.create_all(bind=engine)

# -------------------- AUTH --------------------
@app.post("/api/auth/register", response_model=schemas.UserOut, tags=["auth"])
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    """
    Registro de nuevos usuarios (admin o residente).
    Evita duplicar correos y usa hash seguro para contraseñas.
    """
    # Verificar si el correo ya existe
    existing_user = db.query(models.User).filter_by(email=user_in.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Crear usuario con contraseña cifrada
    user = models.User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        role=user_in.role
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error saving user in database")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@app.post("/api/auth/login", tags=["auth"])
def login(creds: schemas.UserLogin, db: Session = Depends(get_db)):
    """
    Login del usuario: verifica email/contraseña y genera token JWT.
    """
    user = db.query(models.User).filter_by(email=creds.email).first()
    if not user or not verify_password(creds.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "role": user.role}
    }


# -------------------- USERS (solo admin) --------------------
@app.get("/api/users", response_model=List[schemas.UserOut], tags=["users"])
def list_users(db: Session = Depends(get_db), user=Depends(require_role("admin"))):
    return db.query(models.User).all()

# 👇 NUEVO: crear usuario (vía admin)
@app.post("/api/users", response_model=schemas.UserOut, tags=["users"])
def create_user_admin(user_in: schemas.UserCreate, db: Session = Depends(get_db), user=Depends(require_role("admin"))):
    # Evitar duplicados
    if db.query(models.User).filter_by(email=user_in.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    u = models.User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        role=user_in.role
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u

# 👇 NUEVO: actualizar usuario por ID (campos parciales)
@app.put("/api/users/{user_id}", response_model=schemas.UserOut, tags=["users"])
def update_user(user_id: int, body: UserUpdate, db: Session = Depends(get_db), user=Depends(require_role("admin"))):
    u = db.query(models.User).get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    # email duplicado
    if body.email and body.email != u.email:
        if db.query(models.User).filter(models.User.email == body.email).first():
            raise HTTPException(status_code=400, detail="Email already registered")
        u.email = body.email

    if body.name is not None:
        u.name = body.name
    if body.role is not None:
        u.role = body.role
    if body.is_active is not None:
        u.is_active = body.is_active
    if body.password:
        u.hashed_password = hash_password(body.password)

    db.commit()
    db.refresh(u)
    return u

# 👇 NUEVO: eliminar usuario por ID
@app.delete("/api/users/{user_id}", tags=["users"])
def delete_user(user_id: int, db: Session = Depends(get_db), user=Depends(require_role("admin"))):
    u = db.query(models.User).get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(u)
    db.commit()
    return {"detail": "deleted"}



# -------------------- UNITS --------------------
@app.post("/api/units", response_model=schemas.UnitOut, tags=["units"])
def create_unit(unit_in: schemas.UnitIn, db: Session = Depends(get_db), user=Depends(require_role("admin"))):
    unit = models.Unit(**unit_in.dict())
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


@app.get("/api/units", response_model=List[schemas.UnitOut], tags=["units"])
def list_units(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.Unit).all()


# -------------------- AMENITIES --------------------
@app.post("/api/amenities", response_model=schemas.AmenityOut, tags=["amenities"])
def create_amenity(amenity_in: schemas.AmenityIn, db: Session = Depends(get_db), user=Depends(require_role("admin"))):
    a = models.Amenity(**amenity_in.dict())
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@app.get("/api/amenities", response_model=List[schemas.AmenityOut], tags=["amenities"])
def list_amenities(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.Amenity).all()


# -------------------- RESERVATIONS --------------------
@app.post("/api/reservations", response_model=schemas.ReservationOut, tags=["reservations"])
def create_reservation(res_in: schemas.ReservationIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    # Validar solapamientos
    overlap = db.query(models.Reservation).filter(
        models.Reservation.amenity_id == res_in.amenity_id,
        models.Reservation.start_at < res_in.end_at,
        models.Reservation.end_at > res_in.start_at,
    ).first()
    if overlap:
        raise HTTPException(status_code=400, detail="Time slot not available")

    r = models.Reservation(**res_in.dict(), status="pending")
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@app.get("/api/reservations", response_model=List[schemas.ReservationOut], tags=["reservations"])
def list_reservations(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.Reservation).all()


# -------------------- MAINTENANCE --------------------
@app.post("/api/tickets", response_model=schemas.TicketOut, tags=["maintenance"])
def create_ticket(t_in: schemas.TicketIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    t = models.MaintenanceTicket(**t_in.dict())
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@app.get("/api/tickets", response_model=List[schemas.TicketOut], tags=["maintenance"])
def list_tickets(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.MaintenanceTicket).all()


# -------------------- VISITORS --------------------
@app.post("/api/visitors", response_model=schemas.VisitorOut, tags=["visitors"])
def allow_visitor(v_in: schemas.VisitorIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    v = models.VisitorLog(**v_in.dict())
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@app.get("/api/visitors", response_model=List[schemas.VisitorOut], tags=["visitors"])
def list_visitors(db: Session = Depends(get_db), user=Depends(require_role("admin"))):
    return db.query(models.VisitorLog).all()


# -------------------- PAYMENTS (mock) --------------------
@app.post("/api/payments", response_model=schemas.PaymentOut, tags=["payments"])
def create_payment(p_in: schemas.PaymentIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    payment = models.Payment(**p_in.dict(), receipt=f"RCPT-{int(datetime.utcnow().timestamp())}")
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@app.get("/api/payments", response_model=List[schemas.PaymentOut], tags=["payments"])
def list_payments(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.Payment).all()

