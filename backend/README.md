# Village - Backend (FastAPI + SQLite)

## Requisitos
- Python 3.11+
- (Opcional) crear y activar un `venv`

## Instalación
```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Ejecutar
```bash
uvicorn app.main:app --reload
```

- App web mínima: http://127.0.0.1:8000/app/index.html  
- Docs OpenAPI: http://127.0.0.1:8000/docs

## Notas
- JWT muy básico. Cambia `SECRET_KEY` en `app/auth.py` para producción.
- Este prototipo cubre: usuarios, inmuebles (units), amenidades, reservas, tickets de mantenimiento, visitantes y pagos (mock).
