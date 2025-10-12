from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# ⚙️ Configuración de conexión a MySQL (en Docker)
DATABASE_URL = "mysql+pymysql://root:12345@localhost:3306/village_db"

# 🔗 Conexión al motor MySQL (ya no lleva connect_args)
engine = create_engine(DATABASE_URL)

# 🧩 Sesión de base de datos
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 🧱 Clase base para los modelos
class Base(DeclarativeBase):
    pass

# 📦 Dependencia para obtener una sesión en los endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

