// === BASE DE LA API ===
const API_BASE = "http://127.0.0.1:8000";

let token = window.localStorage.getItem("village_token") || null;
let currentRole = window.localStorage.getItem("village_user_role") || null;

// Visibilidad por rol
function applyRoleVisibility(role) {
  document
    .querySelectorAll("[data-role]")
    .forEach((el) => (el.style.display = "none"));

  if (!role) return;

  document
    .querySelectorAll('[data-role="any"]')
    .forEach((el) => (el.style.display = ""));

  if (role === "admin")
    document
      .querySelectorAll('[data-role="admin-only"]')
      .forEach((el) => (el.style.display = ""));
  if (role === "user")
    document
      .querySelectorAll('[data-role="user-only"]')
      .forEach((el) => (el.style.display = ""));
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
function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function notEmpty(v) {
  return v !== null && v !== undefined && String(v).trim() !== "";
}
function isValidRole(r) {
  return r === "user" || r === "admin";
}
function isDateTimeLike(v) {
  return !!v && !isNaN(new Date(String(v).replace(" ", "T")));
}

// Helper de API
async function api(path, method = "GET", body = null) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
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

  try {
    return txt ? JSON.parse(txt) : {};
  } catch {
    return {};
  }
}

/* -------------------- Helpers visuales de USUARIOS -------------------- */
const usersOutEl = () => document.getElementById("users-out");
function hideUsersOut() {
  const el = usersOutEl();
  if (el) {
    el.style.display = "none";
    el.textContent = "";
  }
}
function showUsersOut() {
  const el = usersOutEl();
  if (el) {
    el.style.display = "";
  }
}

/* -------------------- AUTH -------------------- */
async function register() {
  const rawRole = document.getElementById("reg-role")?.value;
  const role = rawRole === "resident" ? "user" : rawRole;

  const name = document.getElementById("reg-name")?.value;
  const email = document.getElementById("reg-email")?.value;
  const password = document.getElementById("reg-pass")?.value;
  const out = document.getElementById("reg-out");

  if (!notEmpty(name)) {
    out.textContent = "";
    showToast("Nombre requerido", "error");
    return;
  }
  if (!isEmail(email)) {
    out.textContent = "";
    showToast("Email inválido", "error");
    return;
  }
  if (!notEmpty(password)) {
    out.textContent = "";
    showToast("Contraseña requerida", "error");
    return;
  }
  if (!isValidRole(role)) {
    out.textContent = "";
    showToast('Rol inválido (usa "user" o "admin")', "error");
    return;
  }

  try {
    await api("/api/auth/register", "POST", { name, email, password, role });
    out.textContent = "";
    showToast("Registro exitoso");
    if (document.getElementById("reg-name"))
      document.getElementById("reg-name").value = "";
    if (document.getElementById("reg-email"))
      document.getElementById("reg-email").value = "";
    if (document.getElementById("reg-pass"))
      document.getElementById("reg-pass").value = "";
    if (document.getElementById("reg-role"))
      document.getElementById("reg-role").value = "resident";
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
  document.getElementById("sb-name").textContent =
    user.name || user.email || "Usuario";
  document.getElementById("sb-role").textContent = user.role || "—";
  sb.style.display = "";
}

/* Usuario actual (para filtros de user) */
function saveCurrentUser(u) {
  localStorage.setItem("village_user", JSON.stringify(u || {}));
}
function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("village_user") || "{}");
  } catch {
    return {};
  }
}

function fmt(dtStr) {
  if (!dtStr) return "—";
  const s = String(dtStr).replace(" ", "T");
  const d = new Date(s);
  if (isNaN(d)) return dtStr;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function isAfter(a, b) {
  return (
    new Date(String(a).replace(" ", "T")).getTime() >
    new Date(String(b).replace(" ", "T")).getTime()
  );
}
function minutesBetween(a, b) {
  return Math.round(
    (new Date(String(b).replace(" ", "T")) -
      new Date(String(a).replace(" ", "T"))) /
      60000
  );
}
function isPast(dt) {
  return new Date(String(dt).replace(" ", "T")).getTime() < Date.now();
}

/* Mostrar / ocultar Login */
function hideAuth() {
  const auth = document.getElementById("auth");
  if (auth) auth.style.display = "none";
}
function showAuth() {
  const auth = document.getElementById("auth");
  if (auth) auth.style.display = "";
}

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

  if (!isEmail(email))
    return (document.getElementById("log-out").textContent = "Email inválido");
  if (!notEmpty(password))
    return (document.getElementById("log-out").textContent =
      "Contraseña requerida");

  try {
    const data = await api("/api/auth/login", "POST", { email, password });
    setToken(data.access_token);
    const user = data.user || {};
    document.getElementById("log-out").textContent =
      "OK: " + JSON.stringify(user);
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
  if (!notEmpty(name)) {
    out.textContent = "";
    showToast("Nombre de área común requerido", "error");
    return;
  }

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
    const lines =
      (data || []).map((a) => `• [${a.id}] ${a.name}`).join("\n") || "—";
    const pretty = `Áreas comunes (${data?.length || 0}):\n${lines}`;
    document.getElementById("amenities-out").textContent = pretty;
  } catch (e) {
    document.getElementById("amenities-out").textContent = e.message;
  }
}
async function deleteAmenity() {
  const out = document.getElementById("amenities-out");
  const id = Number(document.getElementById("amenity-id")?.value);
  if (!id) {
    out.textContent = "";
    showToast("Ingresa un ID válido", "error");
    return;
  }
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

/* -------------------- CACHE DE UNIDADES (también para pagos) -------------------- */
let _unitsCache = null;

async function getUnitsCache() {
  try {
    if (!_unitsCache) _unitsCache = await api("/api/units");
    return _unitsCache || [];
  } catch {
    _unitsCache = [];
    return [];
  }
}

// === UNIDADES ===
async function createUnit() {
  const code = document.getElementById("unit-code").value;
  const owner_id = document.getElementById("unit-owner").value || null;
  const area_m2 = parseFloat(document.getElementById("unit-area").value || "0");
  const out = document.getElementById("units-out");

  if (!notEmpty(code)) {
    out.textContent = "";
    showToast("Código de unidad requerido", "error");
    return;
  }
  if (isNaN(area_m2) || area_m2 <= 0) {
    out.textContent = "";
    showToast("Área inválida", "error");
    return;
  }

  try {
    await api("/api/units", "POST", {
      code,
      owner_id: owner_id ? Number(owner_id) : null,
      area_m2,
    });
    _unitsCache = null;
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
  const out = document.getElementById("units-out");
  const summary = document.getElementById("units-summary");
  const listEl = document.getElementById("units-list");

  if (listEl) listEl.innerHTML = "";
  if (summary) summary.textContent = "";
  if (out) {
    out.style.display = "none";
    out.textContent = "";
  }

  try {
    const [units, users] = await Promise.all([
      api("/api/units"),
      api("/api/users"),
    ]);

    const items = units || [];
    _unitsCache = items;

    const usersById = {};
    (users || []).forEach((u) => {
      usersById[u.id] = u;
    });

    const totalArea = items.reduce(
      (acc, u) => acc + (Number(u.area_m2) || 0),
      0
    );
    const withOwner = items.filter((u) => u.owner_id != null).length;

    if (summary) {
      summary.textContent = `Unidades (${items.length}) — Área total: ${totalArea.toFixed(
        1
      )} m² · Con propietario: ${withOwner}`;
    }

    if (!listEl) return;

    if (!items.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "— Sin unidades —";
      listEl.appendChild(p);
    } else {
      items
        .slice()
        .sort((a, b) => a.id - b.id)
        .forEach((u) => {
          const owner = u.owner_id != null ? usersById[u.owner_id] : null;
          const ownerLabel = owner
            ? `${owner.name || "Sin nombre"} (#${u.owner_id})`
            : "— Sin asignar —";

          const card = document.createElement("div");
          card.className = "card";
          card.innerHTML = `
            <div class="row space" style="align-items:flex-start;gap:8px">
              <div>
                <div style="font-weight:600">[${u.id}] ${u.code}</div>
                <div class="muted small">Área: ${u.area_m2} m²</div>
              </div>
              <div style="text-align:right">
                <div class="muted small">Propietario</div>
                <div class="small">${ownerLabel}</div>
              </div>
            </div>
          `;
          listEl.appendChild(card);
        });
    }
  } catch (e) {
    if (out) {
      out.style.display = "";
      out.textContent = e.message || String(e);
    }
    showToast(e.message || "Error listando unidades", "error");
    console.error("listUnits error:", e);
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
    await api(`/api/units/${id}?detach=true`, "DELETE");
    _unitsCache = null;
    out.textContent = "";
    showToast("Unidad eliminada");
    document.getElementById("unit-id").value = "";
    await listUnits();
  } catch (e) {
    out.textContent = "";
    showToast(e.message || "No se pudo eliminar la unidad", "error");
  }
}

// ====== Helpers fecha/hora ======
function pad2(n) {
  return String(n).padStart(2, "0");
}
function normalizeFromDateObj(d) {
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(
    d.getDate()
  )} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseDateInput(v) {
  if (!v) return null;
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
    const y = s.slice(0, 4);
    const m = s.slice(4, 6);
    const d = s.slice(6, 8);
    const time = s.split(/\s+/)[1];
    const dt = `${y}-${m}-${d}T${time}`;
    const D = new Date(dt);
    return normalizeFromDateObj(D);
  }

  // 5) "DD/MM/YYYY HH:mm"
  if (/^\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}$/.test(s)) {
    const [datePart, timePart] = s.split(/\s+/);
    const [dd, mm, yyyy] = datePart.split("/");
    const iso = `${yyyy}-${mm}-${dd}T${timePart}`;
    const d = new Date(iso);
    return normalizeFromDateObj(d);
  }

  return null;
}

/* ===================== RESERVATIONS ===================== */

function toIsoSecondFromInput(v) {
  const norm = parseDateInput(v);
  if (!norm) return null;
  const [d, hm] = norm.split(" ");
  return `${d}T${hm}:00`;
}

async function createReservation() {
  const out = document.getElementById("reservations-out");
  const me = getCurrentUser();
  const role = me.role || localStorage.getItem("village_user_role") || "";

  const amenity_id = Number(document.getElementById("res-amenity").value);
  const user_id =
    role === "user"
      ? Number(me.id)
      : Number(document.getElementById("res-user").value);

  const start_raw = document.getElementById("res-start").value;
  const end_raw = document.getElementById("res-end").value;

  const start_iso = toIsoSecondFromInput(start_raw);
  const end_iso = toIsoSecondFromInput(end_raw);

  if (!Number.isInteger(amenity_id) || amenity_id < 1) {
    out.textContent = "";
    showToast("Ingresa un amenity_id válido", "error");
    return;
  }
  if (!Number.isInteger(user_id) || user_id < 1) {
    out.textContent = "";
    showToast("Ingresa un user_id válido (o inicia sesión)", "error");
    return;
  }
  if (!start_iso || !end_iso) {
    out.textContent = "";
    showToast("Fechas inválidas. Usa el selector.", "error");
    return;
  }
  if (!isAfter(end_iso, start_iso)) {
    out.textContent = "";
    showToast("La hora de fin debe ser posterior al inicio", "error");
    return;
  }
  if (isPast(start_iso)) {
    out.textContent = "";
    showToast("No puedes reservar en el pasado", "error");
    return;
  }
  const mins = minutesBetween(start_iso, end_iso);
  if (mins <= 0 || mins > 180) {
    out.textContent = "";
    showToast("Duración inválida (máx 180 minutos)", "error");
    return;
  }

  try {
    const data = await api("/api/reservations", "POST", {
      amenity_id,
      user_id,
      start_at: start_iso,
      end_at: end_iso,
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
  const out = document.getElementById("reservations-out");
  const summaryEl = document.getElementById("res-summary");
  const upWrapEl = document.getElementById("res-upcoming");
  const pastWrapEl = document.getElementById("res-past");
  const pastTitleEl = document.getElementById("res-past-title");

  try {
    const data = await api("/api/reservations");
    const me = getCurrentUser();
    const role = me.role || localStorage.getItem("village_user_role") || "";

    const items =
      role === "user"
        ? (data || []).filter((r) => r.user_id === me.id)
        : data || [];

    items.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));

    const upcoming = items.filter((r) => !isPast(r.end_at));
    const past = items.filter((r) => isPast(r.end_at));

    const canDelete = (res) => role === "admin" || res.user_id === me.id;

    const cardHTML = (r, withDelete) => {
      const title = `Reserva #${r.id}`;
      const meta1 = `Amenidad: ${r.amenity_id} — Usuario: ${r.user_id}`;
      const meta2 = `${fmt(r.start_at)} → ${fmt(r.end_at)}`;
      const btn =
        withDelete && canDelete(r)
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

    summaryEl.textContent = `Mis Reservas (${items.length}) — Próximas (${upcoming.length}) — Pasadas (${past.length})`;

    upWrapEl.innerHTML = upcoming.length
      ? upcoming.map((r) => cardHTML(r, true)).join("")
      : `<div class="muted">—</div>`;

    pastWrapEl.innerHTML = past.length
      ? past.map((r) => cardHTML(r, false)).join("")
      : `<div class="muted">—</div>`;

    pastTitleEl.style.display = past.length ? "" : "none";

    out.style.display = "none";
    out.textContent = "";
  } catch (e) {
    out.style.display = "";
    out.textContent = e.message;
    showToast(e.message || "Error listando reservas", "error");
    console.error("listReservations error:", e);
  }
}

async function deleteReservation(id) {
  const out = document.getElementById("reservations-out");
  if (!Number.isInteger(id) || id < 1) {
    showToast("ID de reserva inválido", "error");
    return;
  }

  const tryDelete = async (path) => {
    try {
      await api(path, "DELETE");
      return true;
    } catch (e) {
      if (!/404|Not Found/i.test(String(e))) throw e;
      return false;
    }
  };

  try {
    let ok = await tryDelete(`/api/reservations/${id}`);
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

/* -------------------- TICKETS -------------------- */
async function createTicket() {
  const me = getCurrentUser();
  const role = me.role || localStorage.getItem("village_user_role") || "";
  const forcedUserId = role === "user" ? Number(me.id) : null;

  const body = {
    user_id:
      forcedUserId ?? Number(document.getElementById("tk-user").value),
    unit_id: document.getElementById("tk-unit").value
      ? Number(document.getElementById("tk-unit").value)
      : null,
    title: document.getElementById("tk-title").value.trim(),
    description: document
      .getElementById("tk-desc")
      .value.trim(),
  };

  if (!Number.isInteger(body.user_id)) {
    showToast("user_id numérico", "error");
    return;
  }
  if (!notEmpty(body.title)) {
    showToast("Título requerido", "error");
    return;
  }

  try {
    await api("/api/tickets", "POST", body);
    showToast("✅ Ticket creado");
    if (role === "admin") {
      document.getElementById("tk-user").value = "";
      document.getElementById("tk-unit").value = "";
    }
    document.getElementById("tk-title").value = "";
    document.getElementById("tk-desc").value = "";
    listTickets();
  } catch (e) {
    showToast(e.message || "Error creando ticket", "error");
    console.error("createTicket error:", e);
  }
}

async function listTickets() {
  const summaryEl = document.getElementById("tickets-summary");
  try {
    const data = await api("/api/tickets");
    const me = getCurrentUser();
    const role = me.role || localStorage.getItem("village_user_role") || "";
    const items =
      role === "user" ? (data || []).filter((t) => t.user_id === me.id) : data || [];

    const byUnit = {};
    items.forEach((t) => {
      const k = t.unit_id ?? "—";
      byUnit[k] = (byUnit[k] || 0) + 1;
    });
    const unitStr =
      Object.entries(byUnit)
        .map(([u, c]) => `unidad ${u}: ${c}`)
        .join(" · ") || "—";
    summaryEl.textContent = `Tickets (${items.length}) — Por unidad: ${unitStr}`;

    renderTickets(items);
  } catch (e) {
    summaryEl.textContent = e.message || "Error listando tickets";
    console.error("listTickets error:", e);
  }
}

function renderTickets(items) {
  const list = document.getElementById("tickets-list");
  const me = getCurrentUser();
  const role = me.role || localStorage.getItem("village_user_role") || "";

  list.innerHTML = "";
  if (!items.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "— Sin tickets —";
    list.appendChild(p);
    return;
  }

  items
    .sort((a, b) => a.id - b.id)
    .forEach((t) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div>
            <h4 style="margin:0">Ticket #${t.id}</h4>
            <div class="muted" style="margin-top:2px">
              Usuario: ${t.user_id} ${
        t.unit_id ? `— Unidad: ${t.unit_id}` : "— Unidad: —"
      }
            </div>
          </div>
          ${
            role === "admin"
              ? `<button class="danger" data-del="${t.id}">Eliminar</button>`
              : ""
          }
        </div>
        <p style="margin:8px 0 4px 0; font-weight:600">${t.title}</p>
        <p class="muted" style="margin:0">${
          t.description || "—"
        }</p>
      `;

      const btn = card.querySelector("button[data-del]");
      if (btn)
        btn.addEventListener("click", () =>
          deleteTicket(Number(btn.dataset.del))
        );

      list.appendChild(card);
    });
}

async function deleteTicket(id) {
  if (!id || !Number.isInteger(id)) {
    showToast("ID inválido", "error");
    return;
  }
  try {
    await api(`/api/tickets/${id}`, "DELETE");
    showToast("🗑️ Ticket eliminado");
    listTickets();
  } catch (e) {
    showToast(e.message || "No se pudo eliminar el ticket", "error");
    console.error("deleteTicket error:", e);
  }
}

/* -------------------- PAYMENTS + AUTOFILL -------------------- */

async function findUnitsByOwner(userId) {
  const units = await getUnitsCache();
  return units.filter((u) => u.owner_id === userId);
}

async function onPayUnitChange() {
  const unitEl = document.getElementById("pay-unit");
  const userEl = document.getElementById("pay-user");
  if (!unitEl || !userEl) return;

  const unitId = Number(unitEl.value);
  if (!Number.isInteger(unitId) || unitId <= 0) {
    userEl.readOnly = false;
    userEl.removeAttribute("data-autofilled");
    return;
  }

  const units = await getUnitsCache();
  const u = units.find((x) => x.id === unitId);

  if (u && Number.isInteger(u.owner_id)) {
    userEl.value = String(u.owner_id);
    userEl.setAttribute("data-autofilled", "1");
    userEl.readOnly = true;
    showToast(`Propietario detectado: user_id ${u.owner_id}`);
  } else {
    userEl.readOnly = false;
    userEl.removeAttribute("data-autofilled");
    showToast("Esta unidad no tiene propietario asignado.", "error");
  }
}

async function onPayUserChange() {
  const userEl = document.getElementById("pay-user");
  const unitEl = document.getElementById("pay-unit");
  if (!userEl || !unitEl) return;

  const userId = Number(userEl.value);
  if (!Number.isInteger(userId) || userId <= 0) {
    unitEl.readOnly = false;
    unitEl.removeAttribute("data-autofilled");
    return;
  }

  if (unitEl.value) return;

  const owned = await findUnitsByOwner(userId);
  if (owned.length === 1) {
    const u = owned[0];
    unitEl.value = String(u.id);
    unitEl.setAttribute("data-autofilled", "1");
    unitEl.readOnly = true;
    showToast(`Unidad #${u.id} autoseleccionada`);
  } else if (owned.length > 1) {
    unitEl.readOnly = false;
    unitEl.removeAttribute("data-autofilled");
    showToast(
      `El usuario tiene ${owned.length} unidades. Elige una en unit_id.`,
      "error"
    );
  } else {
    unitEl.readOnly = false;
    unitEl.removeAttribute("data-autofilled");
  }
}

async function createPayment() {
  const userEl = document.getElementById("pay-user");
  const unitEl = document.getElementById("pay-unit");
  const amountEl = document.getElementById("pay-amount");
  const methodEl = document.getElementById("pay-method");

  let user_id = Number(userEl.value);
  let unit_id = unitEl.value ? Number(unitEl.value) : null;
  const amount = parseFloat(
    (amountEl.value || "").toString().replace(/\./g, "").replace(/,/g, ".")
  );
  const method = methodEl.value;

  if (!Number.isInteger(user_id) || user_id <= 0) {
    showToast("Ingresa un user_id válido", "error");
    return;
  }

  if (!unit_id) {
    const owned = await findUnitsByOwner(user_id);
    if (owned.length === 1) {
      unit_id = owned[0].id;
      unitEl.value = String(unit_id);
      unitEl.setAttribute("data-autofilled", "1");
      unitEl.readOnly = true;
      showToast(`Unidad #${unit_id} autoseleccionada`);
    } else if (owned.length > 1) {
      showToast(
        `El usuario tiene ${owned.length} unidades. Elige una.`,
        "error"
      );
      return;
    }
  }

  if (isNaN(amount) || amount <= 0) {
    showToast("Monto inválido", "error");
    return;
  }
  if (!notEmpty(method)) {
    showToast("Método requerido", "error");
    return;
  }

  try {
    await api("/api/payments", "POST", { user_id, unit_id, amount, method });
    showToast("Pago registrado");
    await listPayments();
  } catch (e) {
    showToast(e.message || "Error creando pago", "error");
  }
}

async function listPayments() {
  const outEl = document.getElementById("payments-out");
  const summaryEl = document.getElementById("payments-summary");
  const methodsEl = document.getElementById("payments-methods");
  const listEl = document.getElementById("payments-list");

  try {
    const data = await api("/api/payments");
    const me = getCurrentUser();
    const role = me.role || localStorage.getItem("village_user_role") || "";

    const items =
      role === "user" ? (data || []).filter((p) => p.user_id === me.id) : data || [];

    const sum = (arr, fn) =>
      arr.reduce((acc, x) => acc + (Number(fn(x)) || 0), 0);
    const total = sum(items, (x) => x.amount);
    if (summaryEl)
      summaryEl.textContent = `Pagos (${items.length}) — Total: $${total.toFixed(
        2
      )}`;

    if (methodsEl) {
      if (role === "admin") {
        const byMethod = {};
        items.forEach((p) => {
          byMethod[p.method] =
            (byMethod[p.method] || 0) + (Number(p.amount) || 0);
        });
        const lines = Object.entries(byMethod)
          .map(([m, tot]) => `${m}: $${tot.toFixed(2)}`)
          .join(" · ");
        methodsEl.textContent = lines || "—";
        methodsEl.style.display = "";
      } else {
        methodsEl.textContent = "";
        methodsEl.style.display = "none";
      }
    }

    if (listEl) {
      listEl.innerHTML = "";
      if (!items.length) {
        const p = document.createElement("p");
        p.className = "muted";
        p.textContent = "— Sin pagos —";
        listEl.appendChild(p);
      } else {
        items
          .slice()
          .sort((a, b) => a.id - b.id)
          .forEach((p) => {
            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `
              <div class="row space">
                <strong>Pago #${p.id}</strong>
                <span class="badge">${(p.method || "").toUpperCase()}</span>
              </div>
              <div class="muted small">Usuario: ${p.user_id} — Unidad: ${
              p.unit_id ?? "—"
            }</div>
              <div class="row space" style="margin-top:6px">
                <div>$${Number(p.amount || 0).toFixed(2)}</div>
                <div class="muted small">${fmt(p.paid_at)}</div>
              </div>
              ${
                role === "admin"
                  ? `<div class="actions right" style="margin-top:8px">
                     <button class="danger sm" data-del="${p.id}">Eliminar</button>
                   </div>`
                  : ``
              }
            `;
            const btn = card.querySelector("button[data-del]");
            if (btn)
              btn.addEventListener("click", () =>
                deletePaymentById(Number(btn.dataset.del))
              );
            listEl.appendChild(card);
          });
      }
    }

    if (outEl) {
      outEl.style.display = "none";
      outEl.textContent = "";
    }
  } catch (e) {
    if (outEl) {
      outEl.style.display = "";
      outEl.textContent = e.message || String(e);
    }
    showToast(e.message || "Error listando pagos", "error");
    console.error("listPayments error:", e);
  }
}

async function deletePaymentById(id) {
  try {
    await api(`/api/payments/${id}`, "DELETE");
    showToast("Pago eliminado");
    await listPayments();
  } catch (e) {
    showToast(e.message || "No se pudo eliminar el pago", "error");
  }
}

async function deletePayment() {
  const out = document.getElementById("payments-out");
  const id = Number(document.getElementById("pay-id")?.value);
  if (!id) {
    out.textContent = "";
    showToast("Ingresa un ID válido", "error");
    return;
  }
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

async function createUser() {
  const nameEl = document.getElementById("usr-name");
  const emailEl = document.getElementById("usr-email");
  const passEl = document.getElementById("usr-pass");
  const roleEl = document.getElementById("usr-role");

  const name = (nameEl.value || "").trim();
  const email = (emailEl.value || "").trim();
  const pass = passEl.value || "";
  const rawRole = roleEl.value;
  const role = rawRole === "resident" ? "user" : rawRole;

  if (!notEmpty(name)) {
    showToast("Nombre requerido", "error");
    return;
  }
  if (!isEmail(email)) {
    showToast("Email inválido", "error");
    return;
  }
  if (!notEmpty(pass)) {
    showToast("Contraseña requerida", "error");
    return;
  }
  if (!isValidRole(role)) {
    showToast('Rol inválido (usa "user" o "admin")', "error");
    return;
  }

  try {
    await api(USERS_PATH, "POST", { name, email, password: pass, role });
    showToast("Usuario creado");

    nameEl.value = "";
    emailEl.value = "";
    passEl.value = "";
    roleEl.value = "resident";
    document.getElementById("usr-id").value = "";

    await listUsers();
  } catch (e) {
    showToast(e.message || "Error creando usuario", "error");
  }
}

async function listUsers() {
  const outEl = document.getElementById("users-out");
  const summaryEl = document.getElementById("users-summary");
  const listEl = document.getElementById("users-list");

  if (outEl) {
    outEl.style.display = "none";
    outEl.textContent = "";
  }
  if (summaryEl) summaryEl.textContent = "";
  if (listEl) listEl.innerHTML = "";

  try {
    const data = await api(USERS_PATH);
    const items = data || [];

    const admins = items.filter((u) => u.role === "admin").length;
    const usersCount = items.length - admins;

    if (summaryEl) {
      summaryEl.textContent = `Usuarios (${items.length}) — Admins: ${admins} · Users: ${usersCount}`;
    }

    if (!listEl) return;

    if (!items.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "— Sin usuarios —";
      listEl.appendChild(p);
      return;
    }

    items
      .slice()
      .sort((a, b) => a.id - b.id)
      .forEach((u) => {
        const card = document.createElement("div");
        card.className = "card";

        const roleLabel = (u.role || "user").toUpperCase();
        const badgeClass = roleLabel === "ADMIN" ? "approved" : "pending";

        card.innerHTML = `
          <div class="row space">
            <div>
              <div style="font-weight:600">[${u.id}] ${
          u.name || "(sin nombre)"
        }</div>
              <div class="muted small">${u.email || "— sin email —"}</div>
            </div>
            <span class="badge ${badgeClass}">${roleLabel}</span>
          </div>
          <div class="muted small">Activo: ${u.is_active ? "Sí" : "No"}</div>
        `;

        listEl.appendChild(card);
      });
  } catch (e) {
    if (outEl) {
      outEl.style.display = "";
      outEl.textContent = e.message || String(e);
    }
    showToast(e.message || "Error listando usuarios", "error");
    console.error("listUsers error:", e);
  }
}

async function updateUser() {
  const id = Number(document.getElementById("usr-id").value);
  if (!id) {
    showUsersOut();
    document.getElementById("users-out").textContent = "Falta ID de usuario";
    return;
  }

  const body = {};
  const name = document.getElementById("usr-name").value.trim();
  const email = document.getElementById("usr-email").value.trim();
  const password = document.getElementById("usr-pass").value;
  const role = document.getElementById("usr-role").value.trim();

  if (name) body.name = name;
  if (email) {
    if (!isEmail(email)) {
      showUsersOut();
      document.getElementById("users-out").textContent = "Email inválido";
      return;
    }
    body.email = email;
  }
  if (password) body.password = password;
  if (role) {
    const mapped = role === "resident" ? "user" : role;
    if (!isValidRole(mapped)) {
      showUsersOut();
      document.getElementById("users-out").textContent =
        'Rol inválido (usa "user" o "admin")';
      return;
    }
    body.role = mapped;
  }

  try {
    const data = await api(`${USERS_PATH}/${id}`, "PUT", body);
    showUsersOut();
    document.getElementById("users-out").textContent = JSON.stringify(
      data,
      null,
      2
    );
    await listUsers();
  } catch (e) {
    showUsersOut();
    document.getElementById("users-out").textContent = e.message;
  }
}

async function deleteUser() {
  const id = Number(document.getElementById("usr-id").value);
  if (!id) {
    showUsersOut();
    document.getElementById("users-out").textContent = "Falta ID de usuario";
    return;
  }
  try {
    const data = await api(`${USERS_PATH}/${id}`, "DELETE");
    showUsersOut();
    document.getElementById("users-out").textContent = JSON.stringify(
      data,
      null,
      2
    );
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
  if (!tk) {
    showAuth();
    return;
  }

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

/* -------------------- DOM Ready (ÚNICO) -------------------- */
document.addEventListener("DOMContentLoaded", () => {
  showAuth();
  hideUsersOut();
  document
    .querySelectorAll("form")
    .forEach((f) => f.addEventListener("submit", (e) => e.preventDefault()));

  const s = document.getElementById("res-start");
  const e = document.getElementById("res-end");
  if (s && e) {
    const now = new Date();
    now.setSeconds(0, 0);
    const minIso = now.toISOString().slice(0, 16);
    s.min = minIso;
    e.min = minIso;
  }

  const payUnit = document.getElementById("pay-unit");
  const payUser = document.getElementById("pay-user");
  if (payUnit) {
    payUnit.addEventListener("change", onPayUnitChange);
    payUnit.addEventListener("blur", onPayUnitChange);
  }
  if (payUser) {
    payUser.addEventListener("change", onPayUserChange);
    payUser.addEventListener("blur", onPayUserChange);
  }
  if (payUnit && payUnit.value) onPayUnitChange();
  if (payUser && payUser.value) onPayUserChange();
});

// Exponer funciones al ámbito global para onclick del HTML
window.login = login;

window.createAmenity = createAmenity;
window.listAmenities = listAmenities;
window.deleteAmenity = deleteAmenity;

window.createUnit = createUnit;
window.listUnits = listUnits;
window.deleteUnit = deleteUnit;

window.createReservation = createReservation;
window.listReservations = listReservations;
window.deleteReservation = deleteReservation;

window.createTicket = createTicket;
window.listTickets = listTickets;
window.deleteTicket = deleteTicket;

window.createPayment = createPayment;
window.listPayments = listPayments;
window.deletePayment = deletePayment;

window.createUser = createUser;
window.listUsers = listUsers;
window.updateUser = updateUser;
window.deleteUser = deleteUser;
