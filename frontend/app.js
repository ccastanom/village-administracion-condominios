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
async function register() {
  const rawRole = document.getElementById("reg-role").value;
  const role = rawRole === "resident" ? "user" : rawRole;

  const name = document.getElementById("reg-name").value;
  const email = document.getElementById("reg-email").value;
  const password = document.getElementById("reg-pass").value;

  const out = document.getElementById("reg-out");

  if (!notEmpty(name))        { out.textContent = ""; showToast("Nombre requerido", "error"); return; }
  if (!isEmail(email))        { out.textContent = ""; showToast("Email inválido", "error"); return; }
  if (!notEmpty(password))    { out.textContent = ""; showToast("Contraseña requerida", "error"); return; }
  if (!isValidRole(role))     { out.textContent = ""; showToast('Rol inválido (usa "user" o "admin")', "error"); return; }

  try {
    await api("/api/auth/register", "POST", { name, email, password, role });
    // ✅ Éxito: sin JSON ni autolista
    out.textContent = "";
    showToast("Registro exitoso");
    // limpiar campos
    document.getElementById("reg-name").value = "";
    document.getElementById("reg-email").value = "";
    document.getElementById("reg-pass").value = "";
    document.getElementById("reg-role").value = "resident";
  } catch (e) {
    out.textContent = "";
    showToast(e.message || "Error registrando", "error");
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
    setRole(user.role || null);
    updateSessionBanner(user);
    hideAuth();   // ⬅️ oculta el bloque de login/registro
  } catch (e) {
    document.getElementById("log-out").textContent = e.message;
  }
}

/* ========== AMENITIES ========== */
async function createAmenity() {
  const name = document.getElementById("amenity-name").value;
  if (!notEmpty(name)) return (document.getElementById("amenities-out").textContent = "Nombre requerido");
  try {
    const data = await api("/api/amenities", "POST", { name });
    document.getElementById("amenities-out").textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    document.getElementById("amenities-out").textContent = e.message;
  }
}
async function listAmenities() {
  try {
    const data = await api("/api/amenities");
    document.getElementById("amenities-out").textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    document.getElementById("amenities-out").textContent = e.message;
  }
}

/* ========== UNITS ========== */
async function createUnit() {
  const code = document.getElementById("unit-code").value;
  const owner_id = document.getElementById("unit-owner").value || null;
  const area_m2 = parseFloat(document.getElementById("unit-area").value || "0");
  if (!notEmpty(code)) return (document.getElementById("units-out").textContent = "Código requerido");
  if (isNaN(area_m2) || area_m2 <= 0) return (document.getElementById("units-out").textContent = "Área inválida");

  try {
    const data = await api("/api/units", "POST", { code, owner_id: owner_id ? Number(owner_id) : null, area_m2 });
    document.getElementById("units-out").textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    document.getElementById("units-out").textContent = e.message;
  }
}
async function listUnits() {
  try {
    const data = await api("/api/units");
    document.getElementById("units-out").textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    document.getElementById("units-out").textContent = e.message;
  }
}

/* ========== RESERVATIONS ========== */
async function createReservation() {
  const amenity_id = Number(document.getElementById("res-amenity").value);
  const user_id = Number(document.getElementById("res-user").value);
  const start_raw = document.getElementById("res-start").value; // "YYYY-MM-DD HH:mm"
  const end_raw   = document.getElementById("res-end").value;

  if (!Number.isInteger(amenity_id)) return (document.getElementById("reservations-out").textContent = "amenity_id numérico");
  if (!Number.isInteger(user_id))    return (document.getElementById("reservations-out").textContent = "user_id numérico");
  if (!isDateTimeLike(start_raw) || !isDateTimeLike(end_raw)) {
    return (document.getElementById("reservations-out").textContent = "Fechas inválidas (usa YYYY-MM-DD HH:mm)");
  }

  try {
    const data = await api("/api/reservations", "POST", {
      amenity_id, user_id, start_at: start_raw, end_at: end_raw
    });
    listReservations();
  } catch (e) {
    document.getElementById("reservations-out").textContent = e.message;
  }
}
async function listReservations() {
  try {
    const data = await api("/api/reservations");
    document.getElementById("reservations-out").textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    document.getElementById("reservations-out").textContent = e.message;
  }
}

/* ========== TICKETS ========== */
async function createTicket() {
  const body = {
    user_id: Number(document.getElementById("tk-user").value),
    unit_id: document.getElementById("tk-unit").value ? Number(document.getElementById("tk-unit").value) : null,
    title: document.getElementById("tk-title").value,
    description: document.getElementById("tk-desc").value,
  };
  if (!Number.isInteger(body.user_id)) return (document.getElementById("tickets-out").textContent = "user_id numérico");
  if (!notEmpty(body.title)) return (document.getElementById("tickets-out").textContent = "Título requerido");

  try {
    const data = await api("/api/tickets", "POST", body);
    listTickets();
  } catch (e) {
    document.getElementById("tickets-out").textContent = e.message;
  }
}
async function listTickets() {
  try {
    const data = await api("/api/tickets");
    document.getElementById("tickets-out").textContent = JSON.stringify(data, null, 2);
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
    document.getElementById("payments-out").textContent = JSON.stringify(data, null, 2);
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
    // limpiar campos
    document.getElementById("usr-name").value = "";
    document.getElementById("usr-email").value = "";
    document.getElementById("usr-pass").value = "";
    document.getElementById("usr-role").value = "resident";
    // importante: NO llamar listUsers() aquí
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
  token = null;
  currentRole = null;
  applyRoleVisibility(null);
  document.getElementById("log-out").textContent = "Sesión cerrada";

  // limpiar campos del login
  const emailInput = document.getElementById("log-email");
  const passInput = document.getElementById("log-pass");
  if (emailInput) emailInput.value = "";
  if (passInput) passInput.value = "";

  updateSessionBanner(null); // oculta el banner superior
  showAuth();                // muestra de nuevo el bloque de login/registro
}
window.logout = logout;

/* ===== Banner de sesión (nombre y rol actual) ===== */
function updateSessionBanner(user) {
  const sb = document.getElementById("session-banner");
  if (!sb) return; // seguridad
  if (!user) {
    sb.style.display = "none";
    return;
  }
  // Mostrar el nombre y rol en el banner
  document.getElementById("sb-name").textContent = user.name || user.email || "Usuario";
  document.getElementById("sb-role").textContent = user.role || "—";
  sb.style.display = "";
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

/* ==== Restaurar sesión al cargar la página ==== */
(async function bootstrapUI(){
  const tk = getToken();
  if (!tk) { showAuth(); return; }

  // Intentar /api/auth/me. Si no existe, usar el rol guardado como fallback.
  try {
    const me = await api("/api/auth/me", "GET");
    setRole(me.role || null);
    updateSessionBanner(me);
    hideAuth();
  } catch {
    // Fallback sin /me: solo con rol almacenado
    const role = window.localStorage.getItem("village_user_role") || null;
    if (role) {
      setRole(role);
      updateSessionBanner({ name: "Usuario", role });
      hideAuth();
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



