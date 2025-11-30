// === BASE DE LA API ===
const API_BASE = "http://127.0.0.1:8000";

let token = window.localStorage.getItem("village_token") || null;
let currentRole = window.localStorage.getItem("village_user_role") || null;

// Visibilidad por rol
function applyRoleVisibility(role) {
  document.querySelectorAll("[data-role]").forEach((el) => (el.style.display = "none"));
  if (!role) return;
  document.querySelectorAll('[data-role="any"]').forEach((el) => (el.style.display = ""));
  if (role === "admin")
    document.querySelectorAll('[data-role="admin-only"]').forEach((el) => (el.style.display = ""));
  if (role === "user")
    document.querySelectorAll('[data-role="user-only"]').forEach((el) => (el.style.display = ""));
}
applyRoleVisibility(currentRole);

// Helpers token
function setToken(t) {
  token = t;
  window.localStorage.setItem("village_token", t);
}
function getToken() {
  return token || window.localStorage.getItem("village_token");
}
function setRole(r) {
  currentRole = r;
  window.localStorage.setItem("village_user_role", r || "");
  applyRoleVisibility(r);
}

// Validaciones simples
function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function notEmpty(v) { return v !== null && v !== undefined && String(v).trim() !== ""; }
function isValidRole(r) { return r === "user" || r === "admin"; }
function isDateTimeLike(v) { return !!v && !isNaN(new Date(String(v).replace(" ", "T"))); }

// Helper de API
async function api(path, method = "GET", body = null) {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  const tk = getToken();
  if (tk) headers["Authorization"] = "Bearer " + tk;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    cache: "no-store",
    body: body ? JSON.stringify(body) : null,
  });

  const txt = await res.text();

  if (res.status === 401) {
    logout();
    throw new Error("401 Unauthorized: sesión expirada. Inicia sesión de nuevo.");
  }
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);

  try { return txt ? JSON.parse(txt) : {}; } catch { return {}; }

}


async function deleteReservation(id) {
  if (!id || isNaN(Number(id))) {
    showToast("ID de reserva inválido", "error");
    return;
  }
  try {
    await api(`/api/reservations/${id}`, "DELETE");
    showToast("Reserva eliminada");
    listReservations();
  } catch (e) {
    showToast(e.message || "No se pudo eliminar la reserva", "error");
    console.error("deleteReservation error:", e);
  }
}

// expón al scope global si usas onclick="..."
window.deleteReservation = deleteReservation;









/* -------------------- Helpers visuales de USUARIOS -------------------- */
const usersOutEl = () => document.getElementById("users-out");
function hideUsersOut() {
  const el = usersOutEl();
  if (el) { el.style.display = "none"; el.textContent = ""; }
}
function showUsersOut() {
  const el = usersOutEl();
  if (el) { el.style.display = ""; }
}

/* -------------------- AUTH -------------------- */
async function register() {
  const rawRole = document.getElementById("reg-role")?.value;
  const role = rawRole === "resident" ? "user" : rawRole;

  const name = document.getElementById("reg-name")?.value;
  const email = document.getElementById("reg-email")?.value;
  const password = document.getElementById("reg-pass")?.value;
  const out = document.getElementById("reg-out");

  if (!notEmpty(name)) { out.textContent = ""; showToast("Nombre requerido", "error"); return; }
  if (!isEmail(email)) { out.textContent = ""; showToast("Email inválido", "error"); return; }
  if (!notEmpty(password)) { out.textContent = ""; showToast("Contraseña requerida", "error"); return; }
  if (!isValidRole(role)) { out.textContent = ""; showToast('Rol inválido (usa "user" o "admin")', "error"); return; }

  try {
    await api("/api/auth/register", "POST", { name, email, password, role });
    out.textContent = "";
    showToast("Registro exitoso");
    if (document.getElementById("reg-name")) document.getElementById("reg-name").value = "";
    if (document.getElementById("reg-email")) document.getElementById("reg-email").value = "";
    if (document.getElementById("reg-pass")) document.getElementById("reg-pass").value = "";
    if (document.getElementById("reg-role")) document.getElementById("reg-role").value = "resident";
  } catch (e) {
    out.textContent = "";
    showToast(e.message || "Error registrando", "error");
  }
}

function updateSessionBanner(user) {
  const sb = document.getElementById("session-banner");
  if (!sb) return;
  if (!user) {
    sb.style.display = "none";
    return;
  }
  document.getElementById("sb-name").textContent = user.name || user.email || "Usuario";
  document.getElementById("sb-role").textContent = user.role || "—";
  sb.style.display = "";
}

/* Usuario actual (para filtros de user) */
function saveCurrentUser(u) { localStorage.setItem("village_user", JSON.stringify(u || {})); }
function getCurrentUser() { try { return JSON.parse(localStorage.getItem("village_user") || "{}"); } catch { return {}; } }

function fmt(dtStr) {
  if (!dtStr) return "—";
  const s = String(dtStr).replace(" ", "T");
  const d = new Date(s);
  if (isNaN(d)) return dtStr;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function isAfter(a, b) { return new Date(String(a).replace(" ", "T")).getTime() > new Date(String(b).replace(" ", "T")).getTime(); }
function minutesBetween(a, b) { return Math.round((new Date(String(b).replace(" ", "T")) - new Date(String(a).replace(" ", "T"))) / 60000); }
function isPast(dt) { return new Date(String(dt).replace(" ", "T")).getTime() < Date.now(); }

/* Mostrar / ocultar Login */
function hideAuth() { const auth = document.getElementById("auth"); if (auth) auth.style.display = "none"; }
function showAuth() { const auth = document.getElementById("auth"); if (auth) auth.style.display = ""; }

/* Cargar select de owner_id (admin) */
async function loadOwnerSelect() {
  const sel = document.getElementById("unit-owner");
  if (!sel) return;
  try {
    const users = await api("/api/users");
    sel.innerHTML = '<option value="">— Selecciona propietario —</option>';
    users.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = `${u.id} — ${u.name} (${u.email})`;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.warn("No se pudo cargar owner_id:", e);
  }
}

async function login() {
  const email = document.getElementById("log-email").value;
  const password = document.getElementById("log-pass").value;

  if (!isEmail(email))  return (document.getElementById("log-out").textContent = "Email inválido");
  if (!notEmpty(password)) return (document.getElementById("log-out").textContent = "Contraseña requerida");

  try {
    const data = await api("/api/auth/login", "POST", { email, password });
    setToken(data.access_token);
    const user = data.user || {};
    document.getElementById("log-out").textContent = "OK: " + JSON.stringify(user);
    saveCurrentUser(user);
    setRole(user.role || null);
    updateSessionBanner(user);
    hideAuth();
    if ((user.role || "") === "admin") loadOwnerSelect();
  } catch (e) {
    document.getElementById("log-out").textContent = e.message;
  }
}

// === ÁREAS COMUNES (amenities) ===
async function createAmenity() {
  const name = document.getElementById("amenity-name").value;
  const out = document.getElementById("amenities-out");
  if (!notEmpty(name)) { out.textContent = ""; showToast("Nombre de área común requerido", "error"); return; }

  try {
    await api("/api/amenities", "POST", { name });
    out.textContent = "";
    showToast("Área común creada");
    document.getElementById("amenity-name").value = "";
    await listAmenities();
  } catch (e) {
    out.textContent = "";
    showToast(e.message || "Error creando área común", "error");
  }
}
async function listAmenities() {
  try {
    const data = await api("/api/amenities");
    const lines = (data || []).map((a) => `• [${a.id}] ${a.name}`).join("\n") || "—";
    const pretty = `Áreas comunes (${data?.length || 0}):\n${lines}`;
    document.getElementById("amenities-out").textContent = pretty;
  } catch (e) {
    document.getElementById("amenities-out").textContent = e.message;
  }
}
async function deleteAmenity() {
  const out = document.getElementById("amenities-out");
  const id = Number(document.getElementById("amenity-id")?.value);
  if (!id) { out.textContent = ""; showToast("Ingresa un ID válido", "error"); return; }
  try {
    await api(`/api/amenities/${id}`, "DELETE");
    out.textContent = "";
    showToast("Área común eliminada");
    document.getElementById("amenity-id").value = "";
    await listAmenities();
  } catch (e) {
    out.textContent = "";
    showToast(e.message || "No se pudo eliminar el área común", "error");
  }
}

// === UNIDADES ===
async function createUnit() {
  const code = document.getElementById("unit-code").value;
  const owner_id = document.getElementById("unit-owner").value || null;
  const area_m2 = parseFloat(document.getElementById("unit-area").value || "0");
  const out = document.getElementById("units-out");

  if (!notEmpty(code)) { out.textContent = ""; showToast("Código de unidad requerido", "error"); return; }
  if (isNaN(area_m2) || area_m2 <= 0) { out.textContent = ""; showToast("Área inválida", "error"); return; }

  try {
    await api("/api/units", "POST", { code, owner_id: owner_id ? Number(owner_id) : null, area_m2 });
    out.textContent = "";
    showToast("Unidad creada");
    document.getElementById("unit-code").value = "";
    document.getElementById("unit-owner").value = "";
    document.getElementById("unit-area").value = "";
    await listUnits();
  } catch (e) {
    out.textContent = "";
    showToast(e.message || "Error creando unidad", "error");
  }
}
async function listUnits() {
  try {
    const data = await api("/api/units");
    const lines = (data || [])
      .map((u) => `• [${u.id}] ${u.code} — área: ${u.area_m2} m² — owner_id: ${u.owner_id ?? "—"}`)
      .join("\n") || "—";
    const pretty = `Unidades (${data?.length || 0}):\n${lines}`;
    document.getElementById("units-out").textContent = pretty;
  } catch (e) {
    document.getElementById("units-out").textContent = e.message;
  }
}
async function deleteUnit() {
  const out = document.getElementById("units-out");
  const idStr = (document.getElementById("unit-id")?.value || "").trim();
  const id = Number.parseInt(idStr, 10);

  if (!Number.isInteger(id) || id < 1) {
    out.textContent = "";
    showToast("Ingresa un ID válido (entero ≥ 1)", "error");
    return;
  }

  try {
    await api(`/api/units/${id}`, "DELETE"); // 204 No Content
    out.textContent = "";
    showToast("Unidad eliminada");
    document.getElementById("unit-id").value = "";
    await listUnits();
  } catch (e) {
    out.textContent = "";
    showToast(e.message || "No se pudo eliminar la unidad", "error");
  }
}




// ====== Helpers de fecha/hora (debe ir antes de RESERVATIONS) ======
function pad2(n){ return String(n).padStart(2,"0"); }
function normalizeFromDateObj(d){
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Acepta:
 *  - "YYYY-MM-DD HH:mm"
 *  - "YYYY/MM/DD HH:mm"
 *  - "YYYYMMDD HH:mm"
 *  - "YYYY-MM-DDTHH:mm" (input datetime-local)
 * Devuelve "YYYY-MM-DD HH:mm" o null si inválida
 */


function parseDateInput(v){
  if(!v) return null;
  const s = String(v).trim();

  // 1) datetime-local → "YYYY-MM-DDTHH:mm"
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s);
    return normalizeFromDateObj(d);
  }

  // 2) "YYYY-MM-DD HH:mm"
  if (/^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}$/.test(s)) {
    const d = new Date(s.replace(" ", "T"));
    return normalizeFromDateObj(d);
  }

  // 3) "YYYY/MM/DD HH:mm"
  if (/^\d{4}\/\d{2}\/\d{2}\s+\d{1,2}:\d{2}$/.test(s)) {
    const fixed = s.replace(/\//g, "-").replace(" ", "T");
    const d = new Date(fixed);
    return normalizeFromDateObj(d);
  }

  // 4) "YYYYMMDD HH:mm"
  if (/^\d{8}\s+\d{1,2}:\d{2}$/.test(s)) {
    const y = s.slice(0,4), m = s.slice(4,6), d = s.slice(6,8);
    const time = s.split(/\s+/)[1];
    const dt = `${y}-${m}-${d}T${time}`;
    const D = new Date(dt);
    return normalizeFromDateObj(D);
  }

  // 5) **NUEVO**: "DD/MM/YYYY HH:mm"
  if (/^\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}$/.test(s)) {
    // reordenamos a YYYY-MM-DDTHH:mm
    const [datePart, timePart] = s.split(/\s+/);
    const [dd, mm, yyyy] = datePart.split("/");
    const iso = `${yyyy}-${mm}-${dd}T${timePart}`;
    const d = new Date(iso);
    return normalizeFromDateObj(d);
  }

  return null;
}

// Fecha para mostrar en UI: DD/MM/YYYY HH:mm
function fmtDisplay(v){
  const d = toDate(v); // usa tu helper actual
  if (isNaN(d)) return v;
  const pad = n => String(n).padStart(2,"0");
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}





/* ===================== RESERVATIONS ===================== */

/** De cualquier entrada válida → "YYYY-MM-DDTHH:mm:00" (ISO sin zona) */
function toIsoSecondFromInput(v) {
  const norm = parseDateInput(v);        // Usa tu helper existente
  if (!norm) return null;                // norm = "YYYY-MM-DD HH:mm"
  const [d, hm] = norm.split(" ");
  return `${d}T${hm}:00`;
}

async function createReservation() {
  const out  = document.getElementById("reservations-out");
  const me   = getCurrentUser();
  const role = (me.role || localStorage.getItem("village_user_role") || "");

  const amenity_id = Number(document.getElementById("res-amenity").value);
  const user_id    = role === "user"
    ? Number(me.id)
    : Number(document.getElementById("res-user").value);

  const start_raw = document.getElementById("res-start").value; // datetime-local o texto
  const end_raw   = document.getElementById("res-end").value;

  // 🔁 Normalizamos y convertimos a ISO con segundos (lo que espera FastAPI)
  const start_iso = toIsoSecondFromInput(start_raw);   // "YYYY-MM-DDTHH:mm:00"
  const end_iso   = toIsoSecondFromInput(end_raw);

  // === Validaciones con toast ===
  if (!Number.isInteger(amenity_id) || amenity_id < 1) {
    out.textContent = ""; showToast("Ingresa un amenity_id válido", "error"); return;
  }
  if (!Number.isInteger(user_id) || user_id < 1) {
    out.textContent = ""; showToast("Ingresa un user_id válido (o inicia sesión)", "error"); return;
  }
  if (!start_iso || !end_iso) {
    out.textContent = ""; showToast("Fechas inválidas. Usa el selector.", "error"); return;
  }
  // Nuestras utilidades aceptan ISO (por parseDateInput), así que validamos directo
  if (!isAfter(end_iso, start_iso)) {
    out.textContent = ""; showToast("La hora de fin debe ser posterior al inicio", "error"); return;
  }
  if (isPast(start_iso)) {
    out.textContent = ""; showToast("No puedes reservar en el pasado", "error"); return;
  }
  const mins = minutesBetween(start_iso, end_iso);
  if (mins <= 0 || mins > 180) {
    out.textContent = ""; showToast("Duración inválida (máx 180 minutos)", "error"); return;
  }

  try {
    const data = await api("/api/reservations", "POST", {
      amenity_id,
      user_id,
      start_at: start_iso,  // ✅ ISO
      end_at:   end_iso     // ✅ ISO
    });
    out.textContent = `✅ Reserva creada\n${JSON.stringify(data, null, 2)}`;
    showToast("Reserva creada");
    listReservations();
  } catch (e) {
    out.textContent = e.message;
    showToast(e.message || "Error creando reserva", "error");
    console.error("createReservation error:", e);
  }
}



async function listReservations() {
  const out = document.getElementById("reservations-out"); // queda oculto (solo errores)
  const summaryEl   = document.getElementById("res-summary");
  const upWrapEl    = document.getElementById("res-upcoming");
  const pastWrapEl  = document.getElementById("res-past");
  const pastTitleEl = document.getElementById("res-past-title");

  try {
    const data = await api("/api/reservations");
    const me   = getCurrentUser();
    const role = (me.role || localStorage.getItem("village_user_role") || "");

    // Si el rol es user, sólo ve las suyas
    const items = role === "user" ? (data || []).filter(r => r.user_id === me.id) : (data || []);

    // Ordenar por inicio
    items.sort((a,b) => new Date(a.start_at) - new Date(b.start_at));

    const upcoming = items.filter(r => !isPast(r.end_at));
    const past     = items.filter(r =>  isPast(r.end_at));

    // Render helpers
    const canDelete = (res) => role === "admin" || res.user_id === me.id;
    const cardHTML = (r, withDelete) => {
      const title = `Reserva #${r.id}`;
      const meta1 = `Amenidad: ${r.amenity_id} — Usuario: ${r.user_id}`;
      const meta2 = `${fmt(r.start_at)} → ${fmt(r.end_at)}`;
      const btn   = withDelete && canDelete(r)
        ? `<button class="chip danger" onclick="deleteReservation(${r.id})">Eliminar</button>`
        : "";
      return `
        <div class="res-card">
          <div class="res-card-header">
            <strong>${title}</strong>
          </div>
          <div class="res-card-body">
            <div class="meta">${meta1}</div>
            <div class="time">${meta2}</div>
          </div>
          <div class="res-card-actions">
            ${btn}
          </div>
        </div>`;
    };

    // Resumen
    summaryEl.textContent = `Mis Reservas (${items.length}) — Próximas (${upcoming.length}) — Pasadas (${past.length})`;

    // Próximas (con botón eliminar)
    upWrapEl.innerHTML = upcoming.length
      ? upcoming.map(r => cardHTML(r, true)).join("")
      : `<div class="muted">—</div>`;

    // Pasadas (sin botón)
    pastWrapEl.innerHTML = past.length
      ? past.map(r => cardHTML(r, false)).join("")
      : `<div class="muted">—</div>`;

    pastTitleEl.style.display = past.length ? "" : "none";

    // Oculta área técnica
    out.style.display = "none";
    out.textContent = "";
  } catch (e) {
    out.style.display = "";
    out.textContent = e.message;
    showToast(e.message || "Error listando reservas", "error");
    console.error("listReservations error:", e);
  }
}


// ---- DELETE RESERVATION (con fallback plural/singular) ----
async function deleteReservation(id) {
  const out = document.getElementById("reservations-out");
  if (!Number.isInteger(id) || id < 1) {
    showToast("ID de reserva inválido", "error");
    return;
  }

  // helper que intenta un endpoint y devuelve true/false
  const tryDelete = async (path) => {
    try {
      await api(path, "DELETE");
      return true;
    } catch (e) {
      // si no es 404, relanza para mostrar el error real
      if (!/404|Not Found/i.test(String(e))) throw e;
      return false;
    }
  };

  try {
    // 1) intento con /api/reservations/{id}
    let ok = await tryDelete(`/api/reservations/${id}`);

    // 2) si no existe, intento con /api/reservation/{id}
    if (!ok) ok = await tryDelete(`/api/reservation/${id}`);

    if (!ok) {
      showToast("Ruta DELETE de reservas no encontrada en el backend", "error");
      out.textContent = `La API devolvió 404 para ambos paths: 
- DELETE /api/reservations/${id}
- DELETE /api/reservation/${id}`;
      return;
    }

    showToast("Reserva eliminada");
    await listReservations();
  } catch (e) {
    out.textContent = e.message || String(e);
    showToast(e.message || "No se pudo eliminar la reserva", "error");
    console.error("deleteReservation error:", e);
  }
}

// expón global si aún no lo hiciste
window.deleteReservation = deleteReservation;





// Pinta tarjetas
function renderReservations(items) {
  const summaryEl = document.getElementById("res-summary");
  const upWrap    = document.getElementById("res-upcoming");
  const pastWrap  = document.getElementById("res-past");
  const pastTitle = document.getElementById("res-past-title");

  const sorted   = [...(items || [])].sort((a,b) => new Date(a.start_at) - new Date(b.start_at));
  const upcoming = sorted.filter(r => !isPast(r.end_at));
  const past     = sorted.filter(r =>  isPast(r.end_at));

  if (summaryEl) {
    summaryEl.textContent = `Mis reservas (${items.length}) — Próximas: ${upcoming.length} · Pasadas: ${past.length}`;
  }

  if (upWrap) {
    upWrap.innerHTML = upcoming.map(reservationCardHTML).join("") || `<div class="muted small">—</div>`;
  }

  if (pastWrap) {
    pastWrap.innerHTML = past.map(reservationCardHTML).join("");
  }
  if (pastTitle) {
    pastTitle.style.display = past.length ? "block" : "none";
  }
}

// Tarjeta HTML
function reservationCardHTML(r) {
  const status = (r.status || "pending").toLowerCase();
  return `
    <div class="res-card">
      <div class="row space">
        <span class="title">#${r.id} · Área común ${r.amenity_id}</span>
        <span class="badge ${status}">${(r.status || "pending").toUpperCase()}</span>
      </div>
      <div class="small muted">Usuario: ${r.user_id}</div>
      <div class="time">${fmt(r.start_at)} → ${fmt(r.end_at)}</div>
      <div class="actions right">
        <button class="ghost sm" onclick="cancelReservation(${r.id})">Cancelar</button>
      </div>
    </div>
  `;
}

// Cancelar una reserva (requiere endpoint DELETE en tu API)
async function cancelReservation(id) {
  try {
    await api(`/api/reservations/${id}`, "DELETE");
    showToast("Reserva eliminada");
    await listReservations();
  } catch (e) {
    showToast(e.message || "No se pudo eliminar la reserva", "error");
  }
}

// Exponer helpers (si los necesitas en HTML)
window.listReservations = listReservations;
window.cancelReservation = cancelReservation;
window.createReservation = createReservation;



/* (Opcional recomendado) Limitar min de los inputs datetime-local al tiempo actual */
document.addEventListener("DOMContentLoaded", () => {
  const s = document.getElementById("res-start");
  const e = document.getElementById("res-end");
  if (s && e) {
    const now = new Date(); now.setSeconds(0,0);
    const minIso = now.toISOString().slice(0,16); // YYYY-MM-DDTHH:mm
    s.min = minIso;
    e.min = minIso; 
  }
});







/* -------------------- TICKETS -------------------- */
async function createTicket() {
  const me = getCurrentUser();
  const role = (me.role || localStorage.getItem("village_user_role") || "");
  const forcedUserId = role === "user" ? Number(me.id) : null;

  const body = {
    user_id: forcedUserId ?? Number(document.getElementById("tk-user").value),
    unit_id: document.getElementById("tk-unit").value ? Number(document.getElementById("tk-unit").value) : null,
    title: document.getElementById("tk-title").value,
    description: document.getElementById("tk-desc").value,
  };
  if (!Number.isInteger(body.user_id)) return (document.getElementById("tickets-out").textContent = "user_id numérico");
  if (!notEmpty(body.title)) return (document.getElementById("tickets-out").textContent = "Título requerido");

  try {
    const data = await api("/api/tickets", "POST", body);
    document.getElementById("tickets-out").textContent = `✅ Ticket creado\n${JSON.stringify(data, null, 2)}`;
    listTickets();
  } catch (e) {
    document.getElementById("tickets-out").textContent = e.message;
  }
}
async function listTickets() {
  try {
    const data = await api("/api/tickets");
    const me = getCurrentUser();
    const role = (me.role || localStorage.getItem("village_user_role") || "");
    const items = role === "user" ? (data || []).filter((t) => t.user_id === me.id) : (data || []);

    const byUnit = {};
    items.forEach((t) => { const key = t.unit_id ?? "—"; byUnit[key] = (byUnit[key] || 0) + 1; });
    const unitLines = Object.entries(byUnit).map(([u, c]) => `• unidad ${u}: ${c} ticket(s)`).join("\n") || "—";
    const lines = items.map((t) => `• [#${t.id}] user:${t.user_id} unidad:${t.unit_id ?? "—"} — ${t.title}`).join("\n") || "—";
    const pretty = `Tickets (${items.length})\nPor unidad:\n${unitLines}\n\nListado:\n${lines}\n\nJSON:\n${JSON.stringify(items, null, 2)}`;
    document.getElementById("tickets-out").textContent = pretty;
  } catch (e) {
    document.getElementById("tickets-out").textContent = e.message;
  }
}
async function deleteTicket() {
  const out = document.getElementById("tickets-out");
  const id = Number(document.getElementById("tk-id")?.value);
  if (!id) { out.textContent = ""; showToast("Ingresa un ID válido", "error"); return; }
  try {
    await api(`/api/tickets/${id}`, "DELETE");
    out.textContent = "";
    showToast("Ticket eliminado");
    document.getElementById("tk-id").value = "";
    await listTickets();
  } catch (e) {
    out.textContent = "";
    showToast(e.message || "No se pudo eliminar el ticket", "error");
  }
}

/* -------------------- PAYMENTS -------------------- */
async function createPayment() {
  const body = {
    user_id: Number(document.getElementById("pay-user").value),
    unit_id: document.getElementById("pay-unit")?.value ? Number(document.getElementById("pay-unit").value) : null,
    amount: parseFloat(document.getElementById("pay-amount").value),
    method: document.getElementById("pay-method").value,
  };
  if (!Number.isInteger(body.user_id)) return (document.getElementById("payments-out").textContent = "user_id numérico");
  if (isNaN(body.amount) || body.amount <= 0) return (document.getElementById("payments-out").textContent = "Monto inválido");
  if (!notEmpty(body.method)) return (document.getElementById("payments-out").textContent = "Método requerido");

  try {
    await api("/api/payments", "POST", body);
    listPayments();
  } catch (e) {
    document.getElementById("payments-out").textContent = e.message;
  }
}
async function listPayments() {
  try {
    const data = await api("/api/payments");
    const me = getCurrentUser();
    const role = (me.role || localStorage.getItem("village_user_role") || "");
    const items = role === "user" ? (data || []).filter((p) => p.user_id === me.id) : (data || []);

    const sum = (arr, fn) => arr.reduce((acc, x) => acc + (Number(fn(x)) || 0), 0);
    const total = sum(items, (x) => x.amount);
    let summary = `Pagos (${items.length}) — Total: $${total.toFixed(2)}\n`;

    if (role === "admin") {
      const byMethod = {};
      items.forEach((p) => { byMethod[p.method] = (byMethod[p.method] || 0) + (Number(p.amount) || 0); });
      const meth = Object.entries(byMethod).map(([m, tot]) => `• ${m}: $${tot.toFixed(2)}`).join("\n") || "—";
      summary += `Por método:\n${meth}\n`;
    }

    const lines = items
      .sort((a, b) => a.id - b.id)
      .map((p) => `• [#${p.id}] user:${p.user_id} unidad:${p.unit_id ?? "—"} — $${Number(p.amount || 0).toFixed(2)} (${p.method})`)
      .join("\n") || "—";

    const pretty = `${summary}\nListado:\n${lines}\n\nJSON:\n${JSON.stringify(items, null, 2)}`;
    document.getElementById("payments-out").textContent = pretty;
  } catch (e) {
    document.getElementById("payments-out").textContent = e.message;
  }
}
async function deletePayment() {
  const out = document.getElementById("payments-out");
  const id = Number(document.getElementById("pay-id")?.value);
  if (!id) { out.textContent = ""; showToast("Ingresa un ID válido", "error"); return; }
  try {
    await api(`/api/payments/${id}`, "DELETE");
    out.textContent = "";
    showToast("Pago eliminado");
    document.getElementById("pay-id").value = "";
    await listPayments();
  } catch (e) {
    out.textContent = "";
    showToast(e.message || "No se pudo eliminar el pago", "error");
  }
}

/* -------------------- USERS (CRUD) -------------------- */
const USERS_PATH = "/api/users";

async function listUsers() {
  try {
    const data = await api(USERS_PATH);
    showUsersOut();
    document.getElementById("users-out").textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    showUsersOut();
    document.getElementById("users-out").textContent = e.message;
  }
}
async function createUser() {
  const rawRole = document.getElementById("usr-role").value.trim();
  const role = rawRole === "resident" ? "user" : rawRole;

  const out = document.getElementById("users-out");
  const body = {
    name: document.getElementById("usr-name").value.trim(),
    email: document.getElementById("usr-email").value.trim(),
    password: document.getElementById("usr-pass").value,
    role: role || "user",
  };

  if (!notEmpty(body.name))     { hideUsersOut(); showToast("Nombre requerido", "error"); return; }
  if (!isEmail(body.email))     { hideUsersOut(); showToast("Email inválido", "error"); return; }
  if (!notEmpty(body.password)) { hideUsersOut(); showToast("Contraseña requerida", "error"); return; }
  if (!isValidRole(body.role))  { hideUsersOut(); showToast('Rol inválido (usa "user" o "admin")', "error"); return; }

  try {
    await api(USERS_PATH, "POST", body);
    hideUsersOut();
    showToast("Registro exitoso");
    document.getElementById("usr-name").value = "";
    document.getElementById("usr-email").value = "";
    document.getElementById("usr-pass").value = "";
    document.getElementById("usr-role").value = "resident";
  } catch (e) {
    hideUsersOut();
    showToast(e.message || "Error creando usuario", "error");
  }
}
async function updateUser() {
  const id = Number(document.getElementById("usr-id").value);
  if (!id) { showUsersOut(); document.getElementById("users-out").textContent = "Falta ID de usuario"; return; }

  const body = {};
  const name = document.getElementById("usr-name").value.trim();
  const email = document.getElementById("usr-email").value.trim();
  const password = document.getElementById("usr-pass").value;
  const role = document.getElementById("usr-role").value.trim();

  if (name) body.name = name;
  if (email) {
    if (!isEmail(email)) { showUsersOut(); document.getElementById("users-out").textContent = "Email inválido"; return; }
    body.email = email;
  }
  if (password) body.password = password;
  if (role) {
    const mapped = role === "resident" ? "user" : role;
    if (!isValidRole(mapped)) { showUsersOut(); document.getElementById("users-out").textContent = 'Rol inválido (usa "user" o "admin")'; return; }
    body.role = mapped;
  }

  try {
    const data = await api(`${USERS_PATH}/${id}`, "PUT", body);
    showUsersOut();
    document.getElementById("users-out").textContent = JSON.stringify(data, null, 2);
    await listUsers();
  } catch (e) {
    showUsersOut();
    document.getElementById("users-out").textContent = e.message;
  }
}
async function deleteUser() {
  const id = Number(document.getElementById("usr-id").value);
  if (!id) { showUsersOut(); document.getElementById("users-out").textContent = "Falta ID de usuario"; return; }
  try {
    const data = await api(`${USERS_PATH}/${id}`, "DELETE");
    showUsersOut();
    document.getElementById("users-out").textContent = JSON.stringify(data, null, 2);
    await listUsers();
  } catch (e) {
    showUsersOut();
    document.getElementById("users-out").textContent = e.message;
  }
}

/* -------------------- LOGOUT -------------------- */
function logout() {
  localStorage.removeItem("village_token");
  localStorage.removeItem("village_user_role");
  localStorage.removeItem("village_user");
  token = null;
  currentRole = null;
  applyRoleVisibility(null);
  document.getElementById("log-out").textContent = "Sesión cerrada";
  const emailInput = document.getElementById("log-email");
  const passInput = document.getElementById("log-pass");
  if (emailInput) emailInput.value = "";
  if (passInput) passInput.value = "";
  updateSessionBanner(null);
  showAuth();
}
window.logout = logout;

/* -------------------- Bootstrap UI -------------------- */
(async function bootstrapUI() {
  const tk = getToken();
  if (!tk) { showAuth(); return; }

  try {
    const me = await api("/api/auth/me", "GET");
    saveCurrentUser(me);
    setRole(me.role || null);
    updateSessionBanner(me);
    hideAuth();
    if ((me.role || "") === "admin") loadOwnerSelect();
  } catch {
    const role = window.localStorage.getItem("village_user_role") || null;
    if (role) {
      setRole(role);
      updateSessionBanner({ name: "Usuario", role });
      hideAuth();
      if (role === "admin") loadOwnerSelect();
    } else {
      showAuth();
    }
  }
})();

/* -------------------- Toast -------------------- */
function showToast(message, type = "success") {
  const el = document.getElementById("toast");
  if (!el) return alert(message);
  el.textContent = message;
  el.classList.remove("hidden", "error", "show");
  if (type === "error") el.classList.add("error");
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.classList.add("hidden"), 250);
  }, 2500);
}

/* -------------------- DOM Ready -------------------- */
document.addEventListener("DOMContentLoaded", () => {
  showAuth();      // se ocultará tras login
  hideUsersOut();  // oculta el área JSON de usuarios al inicio
  document.querySelectorAll("form").forEach((f) => f.addEventListener("submit", (e) => e.preventDefault()));
});


// Exponer funciones al ámbito global para onclick del HTML
window.login = login;

window.createAmenity = createAmenity;
window.listAmenities = listAmenities;
window.deleteAmenity = deleteAmenity;

window.createUnit = createUnit;
window.listUnits = listUnits;
window.deleteUnit = deleteUnit;

//window.createReservation = createReservation;
//window.listReservations = listReservations;

window.createTicket = createTicket;
window.listTickets = listTickets;
window.deleteTicket = deleteTicket;

window.createPayment = createPayment;
window.listPayments = listPayments;
window.deletePayment = deletePayment;

