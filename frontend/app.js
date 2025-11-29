// build toast7

// === BASE DE LA API ===
const API_BASE = "http://127.0.0.1:8000";

let token = window.localStorage.getItem("village_token") || null;
let currentRole = window.localStorage.getItem("village_user_role") || null;

// Visibilidad por rol (usa data-role="admin-only" | "user-only" | "any" en tu HTML)
function applyRoleVisibility(role) {
  document.querySelectorAll("[data-role]").forEach(el => (el.style.display = "none"));
  if (!role) return;
  document.querySelectorAll('[data-role="any"]').forEach(el => (el.style.display = ""));
  if (role === "admin") document.querySelectorAll('[data-role="admin-only"]').forEach(el => (el.style.display = ""));
  if (role === "user")  document.querySelectorAll('[data-role="user-only"]').forEach(el => (el.style.display = ""));
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

// --- helpers de validación muy simples ---
function isEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function notEmpty(v){ return v !== null && v !== undefined && String(v).trim() !== ""; }
function isValidRole(r){ return r === "user" || r === "admin"; }
function isDateTimeLike(v){ return !!v && !isNaN(new Date(String(v).replace(" ", "T"))); }

// --- helper genérico para la API ---
async function api(path, method = "GET", body = null) {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  const tk = getToken();
  if (tk) headers["Authorization"] = "Bearer " + tk;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    cache: "no-store",
    body: body ? JSON.stringify(body) : null
  });

  const txt = await res.text();

  // Manejo 401: limpiar sesión y avisar
  if (res.status === 401) {
    logout();
    throw new Error("401 Unauthorized: sesión expirada. Inicia sesión de nuevo.");
  }

  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
  try { return txt ? JSON.parse(txt) : {}; } catch { return {}; }
}

/* =========================
   Helpers visuales de USUARIOS
   ========================= */
const usersOutEl = () => document.getElementById("users-out");
function hideUsersOut() {
  const el = usersOutEl();
  if (el) { el.style.display = "none"; el.textContent = ""; }
}
function showUsersOut() {
  const el = usersOutEl();
  if (el) { el.style.display = ""; }
}

/* ========== AUTH ========== */
// (Puedes dejar register() aunque no se use en UI)
async function register() {
  const rawRole = document.getElementById("reg-role")?.value;
  const role = rawRole === "resident" ? "user" : rawRole;

  const name = document.getElementById("reg-name")?.value;
  const email = document.getElementById("reg-email")?.value;
  const password = document.getElementById("reg-pass")?.value;

  const out = document.getElementById("reg-out");

  if (!notEmpty(name))        { out.textContent = ""; showToast("Nombre requerido", "error"); return; }
  if (!isEmail(email))        { out.textContent = ""; showToast("Email inválido", "error"); return; }
  if (!notEmpty(password))    { out.textContent = ""; showToast("Contraseña requerida", "error"); return; }
  if (!isValidRole(role))     { out.textContent = ""; showToast('Rol inválido (usa "user" o "admin")', "error"); return; }

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

/* ===== Banner de sesión (nombre y rol actual) ===== */
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

/* ==== Usuario actual + formatos/tiempos para lógica de demo ==== */
function saveCurrentUser(u){ localStorage.setItem("village_user", JSON.stringify(u||{})); }
function getCurrentUser(){
  try { return JSON.parse(localStorage.getItem("village_user")||"{}"); } catch { return {}; }
}
function fmt(dtStr){
  if(!dtStr) return "—";
  const s = String(dtStr).replace(" ", "T");
  const d = new Date(s);
  if (isNaN(d)) return dtStr;
  const pad = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function isAfter(a,b){
  const A=new Date(String(a).replace(" ","T"));
  const B=new Date(String(b).replace(" ","T"));
  return A.getTime()>B.getTime();
}
function minutesBetween(a,b){
  const A=new Date(String(a).replace(" ","T")).getTime();
  const B=new Date(String(b).replace(" ","T")).getTime();
  return Math.round((B-A)/60000);
}
function isPast(dt){
  const t = new Date(String(dt).replace(" ","T")).getTime();
  return t < Date.now();
}

/* ==== Mostrar / ocultar sección de autenticación ==== */
function hideAuth() {
  const auth = document.getElementById("auth");
  if (auth) auth.style.display = "none";
}
function showAuth() {
  const auth = document.getElementById("auth");
  if (auth) auth.style.display = "";
}

/* ==== Select dinámico de owner_id (admin) ==== */
async function loadOwnerSelect() {
  const sel = document.getElementById("unit-owner");
  if (!sel) return;
  try {
    const users = await api("/api/users");
    sel.innerHTML = '<option value="">— Selecciona propietario —</option>';
    users.forEach(u => {
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

  const body = { email, password };
  try {
    const data = await api("/api/auth/login", "POST", body);
    setToken(data.access_token);
    const user = data.user || {};
    document.getElementById("log-out").textContent = "OK: " + JSON.stringify(user);
    saveCurrentUser(user);                 // ✅ guarda id/role para la lógica
    setRole(user.role || null);
    updateSessionBanner(user);
    hideAuth();                            // ⬅️ oculta el login
    if ((user.role || "") === "admin") {
      loadOwnerSelect();                   // preparar select de owner_id
    }
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
    // nada de JSON:
    out.textContent = "";
    showToast("Área común creada");
    // limpiar campo
    document.getElementById("amenity-name").value = "";
    // (opcional) refrescar listado
    await listAmenities();
  } catch (e) {
    out.textContent = "";
    showToast(e.message || "Error creando área común", "error");
  }
}

async function listAmenities() {
  try {
    const data = await api("/api/amenities");
    const lines = (data||[]).map(a=>`• [${a.id}] ${a.name}`).join("\n") || "—";
    const pretty = `Áreas comunes (${data?.length||0}):\n${lines}`;
    document.getElementById("amenities-out").textContent = pretty;
  } catch (e) {
    document.getElementById("amenities-out").textContent = e.message;
  }
}

// === UNIDADES (propiedades) ===
async function createUnit() {
  const code = document.getElementById("unit-code").value;
  const owner_id = document.getElementById("unit-owner").value || null;
  const area_m2 = parseFloat(document.getElementById("unit-area").value || "0");
  const out = document.getElementById("units-out");

  if (!notEmpty(code))          { out.textContent = ""; showToast("Código de unidad requerido", "error"); return; }
  if (isNaN(area_m2) || area_m2 <= 0) { out.textContent = ""; showToast("Área inválida", "error"); return; }

  try {
    await api("/api/units", "POST", { code, owner_id: owner_id ? Number(owner_id) : null, area_m2 });
    // nada de JSON:
    out.textContent = "";
    showToast("Unidad creada");
    // limpiar campos
    document.getElementById("unit-code").value = "";
    document.getElementById("unit-owner").value = "";
    document.getElementById("unit-area").value = "";
    // (opcional) refrescar listado
    await listUnits();
  } catch (e) {
    out.textContent = "";
    showToast(e.message || "Error creando unidad", "error");
  }
}

async function listUnits() {
  try {
    const data = await api("/api/units");
    const lines = (data||[]).map(u=>`• [${u.id}] ${u.code} — área: ${u.area_m2} m² — owner_id: ${u.owner_id ?? "—"}`).join("\n") || "—";
    const pretty = `Unidades (${data?.length||0}):\n${lines}`;
    document.getElementById("units-out").textContent = pretty;
  } catch (e) {
    document.getElementById("units-out").textContent = e.message;
  }
}


/* ========== RESERVATIONS ========== */
async function createReservation() {
  // Si el rol es user, forzar su propio id
  const me = getCurrentUser();
  const role = (me.role || localStorage.getItem("village_user_role") || "");
  const amenity_id = Number(document.getElementById("res-amenity").value);
  const user_id = role === "user" ? Number(me.id) : Number(document.getElementById("res-user").value);
  const start_raw = document.getElementById("res-start").value; // "YYYY-MM-DD HH:mm"
  const end_raw   = document.getElementById("res-end").value;

  if (!Number.isInteger(amenity_id)) return (document.getElementById("reservations-out").textContent = "amenity_id numérico");
  if (!Number.isInteger(user_id))    return (document.getElementById("reservations-out").textContent = "user_id numérico");
  if (!isDateTimeLike(start_raw) || !isDateTimeLike(end_raw)) {
    return (document.getElementById("reservations-out").textContent = "Fechas inválidas (usa YYYY-MM-DD HH:mm)");
  }
  if (!isAfter(end_raw, start_raw)) {
    return (document.getElementById("reservations-out").textContent = "La hora de fin debe ser posterior al inicio");
  }
  if (isPast(start_raw)) {
    return (document.getElementById("reservations-out").textContent = "No puedes reservar en el pasado");
  }
  const mins = minutesBetween(start_raw, end_raw);
  if (mins <= 0 || mins > 180) {
    return (document.getElementById("reservations-out").textContent = "Duración inválida (máximo 180 minutos)");
  }

  try {
    const data = await api("/api/reservations", "POST", {
      amenity_id, user_id, start_at: start_raw, end_at: end_raw
    });
    document.getElementById("reservations-out").textContent =
      `✅ Reserva creada\n${JSON.stringify(data, null, 2)}`;
    listReservations();
  } catch (e) {
    document.getElementById("reservations-out").textContent = e.message;
  }
}
async function listReservations() {
  try {
    const data = await api("/api/reservations");
    const me = getCurrentUser();
    const role = (me.role || localStorage.getItem("village_user_role") || "");
    const items = (role === "user") ? (data||[]).filter(r => r.user_id === me.id) : (data||[]);

    items.sort((a,b)=> new Date(a.start_at) - new Date(b.start_at));
    const upcoming = items.filter(r=> !isPast(r.end_at));
    const past     = items.filter(r=>  isPast(r.end_at));

    const fmtLine = r => `• [#${r.id}] amenity:${r.amenity_id} — user:${r.user_id} — ${fmt(r.start_at)} → ${fmt(r.end_at)}`;
    const upLines = upcoming.map(fmtLine).join("\n") || "—";
    const paLines = past.map(fmtLine).join("\n") || "—";

    const pretty = `Mis Reservas (${items.length})\n\nPróximas (${upcoming.length}):\n${upLines}\n\nPasadas (${past.length}):\n${paLines}\n\nJSON:\n${JSON.stringify(items,null,2)}`;
    document.getElementById("reservations-out").textContent = pretty;
  } catch (e) {
    document.getElementById("reservations-out").textContent = e.message;
  }
}

/* ========== TICKETS ========== */
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
    document.getElementById("tickets-out").textContent = `✅ Ticket creado\n${JSON.stringify(data,null,2)}`;
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
    const items = (role === "user") ? (data||[]).filter(t => t.user_id === me.id) : (data||[]);

    const byUnit = {};
    items.forEach(t=>{
      const key = t.unit_id ?? "—";
      byUnit[key] = (byUnit[key]||0)+1;
    });
    const unitLines = Object.entries(byUnit).map(([u,c])=>`• unidad ${u}: ${c} ticket(s)`).join("\n") || "—";
    const lines = items.map(t=>`• [#${t.id}] user:${t.user_id} unidad:${t.unit_id ?? "—"} — ${t.title}`).join("\n") || "—";
    const pretty = `Tickets (${items.length})\nPor unidad:\n${unitLines}\n\nListado:\n${lines}\n\nJSON:\n${JSON.stringify(items,null,2)}`;
    document.getElementById("tickets-out").textContent = pretty;
  } catch (e) {
    document.getElementById("tickets-out").textContent = e.message;
  }
}

/* ========== PAYMENTS ========== */
async function createPayment() {
  const body = {
    user_id: Number(document.getElementById("pay-user").value),
    unit_id: document.getElementById("pay-unit")?.value ? Number(document.getElementById("pay-unit").value) : null,
    amount: parseFloat(document.getElementById("pay-amount").value),
    method: document.getElementById("pay-method").value
  };
  if (!Number.isInteger(body.user_id)) return (document.getElementById("payments-out").textContent = "user_id numérico");
  if (isNaN(body.amount) || body.amount <= 0) return (document.getElementById("payments-out").textContent = "Monto inválido");
  if (!notEmpty(body.method)) return (document.getElementById("payments-out").textContent = "Método requerido");

  try {
    const data = await api("/api/payments", "POST", body);
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

    const items = (role === "user") ? (data||[]).filter(p => p.user_id === me.id) : (data||[]);

    const sum = (arr,fn)=> arr.reduce((acc,x)=> acc + (Number(fn(x))||0), 0);
    const total = sum(items, x=>x.amount);

    let summary = `Pagos (${items.length}) — Total: $${total.toFixed(2)}\n`;

    if (role === "admin") {
      const byMethod = {};
      items.forEach(p=>{
        byMethod[p.method] = (byMethod[p.method]||0) + (Number(p.amount)||0);
      });
      const meth = Object.entries(byMethod).map(([m,tot])=>`• ${m}: $${tot.toFixed(2)}`).join("\n") || "—";
      summary += `Por método:\n${meth}\n`;
    }

    const lines = items
      .sort((a,b)=> (a.id-b.id))
      .map(p=>`• [#${p.id}] user:${p.user_id} unidad:${p.unit_id ?? "—"} — $${Number(p.amount||0).toFixed(2)} (${p.method})`)
      .join("\n") || "—";

    const pretty = `${summary}\nListado:\n${lines}\n\nJSON:\n${JSON.stringify(items,null,2)}`;
    document.getElementById("payments-out").textContent = pretty;
  } catch (e) {
    document.getElementById("payments-out").textContent = e.message;
  }
}

/* ========== USERS (CRUD) ========== */
const USERS_PATH = "/api/users";

async function listUsers() {
  try {
    const data = await api(USERS_PATH);
    showUsersOut(); // ← mostrar SOLO cuando listamos
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
    hideUsersOut();                 // ✅ no mostrar JSON
    showToast("Registro exitoso");  // ✅ solo notificación
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

/* ========== LOGOUT ========== */
function logout() {
  localStorage.removeItem("village_token");
  localStorage.removeItem("village_user_role");
  localStorage.removeItem("village_user"); // 🔄 limpia usuario actual
  token = null;
  currentRole = null;
  applyRoleVisibility(null);
  document.getElementById("log-out").textContent = "Sesión cerrada";

  // limpiar campos del login
  const emailInput = document.getElementById("log-email");
  const passInput = document.getElementById("log-pass");
  if (emailInput) emailInput.value = "";
  if (passInput) passInput.value = "";

  updateSessionBanner(null);
  showAuth();
}
window.logout = logout;

/* ==== Restaurar sesión al cargar la página ==== */
(async function bootstrapUI(){
  const tk = getToken();
  if (!tk) { showAuth(); return; }

  // Intentar /api/auth/me. Si no existe, usar el rol guardado como fallback.
  try {
    const me = await api("/api/auth/me", "GET");
    saveCurrentUser(me);
    setRole(me.role || null);
    updateSessionBanner(me);
    hideAuth();
    if ((me.role || "") === "admin") {
      loadOwnerSelect();
    }
  } catch {
    const role = window.localStorage.getItem("village_user_role") || null;
    if (role) {
      setRole(role);
      const fallback = { name: "Usuario", role };
      updateSessionBanner(fallback);
      hideAuth();
      if (role === "admin") loadOwnerSelect();
    } else {
      showAuth();
    }
  }
})();

/* ==== Toast ==== */
function showToast(message, type = "success") {
  const el = document.getElementById("toast");
  if (!el) return alert(message); // fallback
  el.textContent = message;
  el.classList.remove("hidden", "error", "show");
  if (type === "error") el.classList.add("error");
  // mostrar
  requestAnimationFrame(() => el.classList.add("show"));
  // ocultar a los 2.5s
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.classList.add("hidden"), 250);
  }, 2500);
}

/* ==== Al cargar DOM ==== */
document.addEventListener("DOMContentLoaded", () => {
  showAuth();      // se ocultará tras login
  hideUsersOut();  // oculta el área JSON de usuarios al inicio
  // Evita submit por defecto si hay formularios
  document.querySelectorAll("form").forEach(f =>
    f.addEventListener("submit", e => e.preventDefault())
  );
});


