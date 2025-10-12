# Village — Prototipo en Código (Full-Stack mínimo)

Este prototipo implementa un backend FastAPI con SQLite y un frontend estático muy simple (HTML+JS) para cubrir los módulos mínimos descritos: usuarios, inmuebles, reservas de áreas comunes, mantenimiento, visitantes y pagos (mock).

## Cómo correr
1. Instala dependencias y arranca FastAPI:
   ```bash
   cd backend
   python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```
2. Abre la UI mínima: http://127.0.0.1:8000/app/index.html  
   Documentación de APIs: http://127.0.0.1:8000/docs

> Nota: Cambia `SECRET_KEY` en `app/auth.py` si haces demos públicas. Este es un prototipo académico.

## Qué incluye
- Autenticación (registro/login) con JWT básico.
- CRUD básico: Amenidades y Unidades (admin).
- Reservas con validación de solapamiento.
- Tickets de mantenimiento.
- Registro de visitantes.
- Pagos simulados (genera un receipt de ejemplo).

## Siguientes pasos sugeridos
- Roles y permisos más finos (admin vs residente por endpoints).
- Pasarela real (PayU / MercadoPago).
- Notificaciones por correo (SendGrid / Mailgun).
- UI en React/Angular (este prototipo usa HTML+JS para ser 100% portable).
