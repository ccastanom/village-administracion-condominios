from fastapi import FastAPI, Depends, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from typing import List, Optional
from pathlib import Path
from pydantic import BaseModel, EmailStr

from .database import Base, engine, get_db
from . import models, schemas
from .auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_role,
)
from fastapi import FastAPI, Depends, HTTPException, Response, Query


# -------------------- APP & CORS & FRONTEND --------------------

# Modelo de actualización (para no tocar schemas.py)
class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


# 1) Crear la app
app = FastAPI(title="Village - Gestión de Condominios")

# 2) CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",  # Live Server
        "http://127.0.0.1:4200",
        "http://localhost:4200",  # Angular
        "http://127.0.0.1:5173",
        "http://localhost:5173",  # python -m http.server
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],  # incluye Authorization
)

# 3) Montar el frontend en /app
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
app.mount("/app", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="app")


@app.get("/", response_class=HTMLResponse)
def root():
    return '<meta http-equiv="refresh" content="0; url=/app/index.html" />'


# 4) Crear tablas automáticamente
Base.metadata.create_all(bind=engine)

# -------------------- AUTH --------------------
@app.post("/api/auth/register", response_model=schemas.UserOut, tags=["auth"])
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter_by(email=user_in.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        role=user_in.role,
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
    user = db.query(models.User).filter_by(email=creds.email).first()
    if not user or not verify_password(creds.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "role": user.role},
    }


# 👇 NUEVO: /me (lo usa el frontend)
@app.get("/api/auth/me", response_model=schemas.UserOut, tags=["auth"])
def me(user=Depends(get_current_user)):
    return user


# -------------------- USERS (solo admin) --------------------
@app.get("/api/users", response_model=List[schemas.UserOut], tags=["users"])
def list_users(db: Session = Depends(get_db), user=Depends(require_role("admin"))):
    return db.query(models.User).all()


@app.post("/api/users", response_model=schemas.UserOut, tags=["users"])
def create_user_admin(
    user_in: schemas.UserCreate,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    if db.query(models.User).filter_by(email=user_in.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    u = models.User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        role=user_in.role,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@app.put("/api/users/{user_id}", response_model=schemas.UserOut, tags=["users"])
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    u = db.query(models.User).get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

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


@app.delete("/api/users/{user_id}", tags=["users"])
def delete_user(
    user_id: int, db: Session = Depends(get_db), user=Depends(require_role("admin"))
):
    u = db.query(models.User).get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(u)
    db.commit()
    return {"detail": "deleted"}


# -------------------- UNITS --------------------
@app.post("/api/units", response_model=schemas.UnitOut, tags=["units"])
def create_unit(
    unit_in: schemas.UnitIn,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    unit = models.Unit(**unit_in.dict())
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


@app.get("/api/units", response_model=List[schemas.UnitOut], tags=["units"])
def list_units(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.Unit).all()


@app.delete("/api/units/{unit_id}", status_code=204, tags=["units"])
def delete_unit(
    unit_id: int,
    detach: bool = Query(False),
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    unit = db.query(models.Unit).get(unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    try:
        if detach:
            # Soltar referencias (poner unit_id = NULL) en tickets y pagos
            db.query(models.MaintenanceTicket).filter(
                models.MaintenanceTicket.unit_id == unit_id
            ).update({models.MaintenanceTicket.unit_id: None}, synchronize_session=False)

            db.query(models.Payment).filter(
                models.Payment.unit_id == unit_id
            ).update({models.Payment.unit_id: None}, synchronize_session=False)

            db.commit()  # Guardar los NULL antes de borrar la unidad

        db.delete(unit)
        db.commit()
        return Response(status_code=204)

    except IntegrityError:
        db.rollback()
        # Si aún quedan referencias (por triggers, FK sin permitir NULL, etc.)
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar: existen pagos/tickets que referencian esta unidad",
        )



# -------------------- AMENITIES --------------------
@app.post("/api/amenities", response_model=schemas.AmenityOut, tags=["amenities"])
def create_amenity(
    amenity_in: schemas.AmenityIn,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    a = models.Amenity(**amenity_in.dict())
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@app.get("/api/amenities", response_model=List[schemas.AmenityOut], tags=["amenities"])
def list_amenities(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.Amenity).all()


@app.delete("/api/amenities/{amenity_id}", status_code=204, tags=["amenities"])
def delete_amenity(
    amenity_id: int, db: Session = Depends(get_db), user=Depends(require_role("admin"))
):
    a = db.query(models.Amenity).get(amenity_id)
    if not a:
        raise HTTPException(status_code=404, detail="Amenidad no encontrada")
    try:
        db.delete(a)
        db.commit()
        return Response(status_code=204)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar: existen reservas que referencian esta área común",
        )


# -------------------- RESERVATIONS --------------------
@app.post("/api/reservations", response_model=schemas.ReservationOut, tags=["reservations"])
def create_reservation(
    res_in: schemas.ReservationIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    overlap = (
        db.query(models.Reservation)
        .filter(
            models.Reservation.amenity_id == res_in.amenity_id,
            models.Reservation.start_at < res_in.end_at,
            models.Reservation.end_at > res_in.start_at,
        )
        .first()
    )
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


@app.delete("/api/reservations/{res_id}", status_code=204, tags=["reservations"])
def delete_reservation(
    res_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    r = db.get(models.Reservation, res_id)  # o db.query(models.Reservation).get(res_id)
    if not r:
        raise HTTPException(status_code=404, detail="Not Found")

    # Permisos: admin o dueño de la reserva
    if getattr(user, "role", "") != "admin" and r.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    db.delete(r)
    db.commit()
    return Response(status_code=204)
# 👆👆 FIN DELETE 👆👆





# -------------------- MAINTENANCE --------------------
@app.post("/api/tickets", response_model=schemas.TicketOut, tags=["maintenance"])
def create_ticket(
    t_in: schemas.TicketIn, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    t = models.MaintenanceTicket(**t_in.dict())
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@app.get("/api/tickets", response_model=List[schemas.TicketOut], tags=["maintenance"])
def list_tickets(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.MaintenanceTicket).all()


@app.delete("/api/tickets/{ticket_id}", status_code=204, tags=["maintenance"])
def delete_ticket(
    ticket_id: int, db: Session = Depends(get_db), user=Depends(require_role("admin"))
):
    t = db.query(models.MaintenanceTicket).get(ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    db.delete(t)
    db.commit()
    return Response(status_code=204)


# -------------------- VISITORS --------------------
@app.post("/api/visitors", response_model=schemas.VisitorOut, tags=["visitors"])
def allow_visitor(
    v_in: schemas.VisitorIn, db: Session = Depends(get_db), user=Depends(get_current_user)
):
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
def create_payment(
    p_in: schemas.PaymentIn, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    payment = models.Payment(
        **p_in.dict(), receipt=f"RCPT-{int(datetime.utcnow().timestamp())}"
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@app.get("/api/payments", response_model=List[schemas.PaymentOut], tags=["payments"])
def list_payments(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.Payment).all()


@app.delete("/api/payments/{payment_id}", status_code=204, tags=["payments"])
def delete_payment(
    payment_id: int, db: Session = Depends(get_db), user=Depends(require_role("admin"))
):
    p = db.query(models.Payment).get(payment_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    db.delete(p)
    db.commit()
    return Response(status_code=204)

