// === BASE DE LA API ===
const API_BASE = "http://127.0.0.1:8000";

let token = null;

function setToken(t) {
  token = t;
  window.localStorage.setItem("village_token", t);
}
function getToken() {
  return token || window.localStorage.getItem("village_token");
}

// ⚠️ Solo para pruebas locales: si quieres, descomenta la siguiente línea.
// setToken("TU_TOKEN_AQUI");

// --- helper genérico para la API ---
async function api(path, method = "GET", body = null) {
  const headers = { "Content-Type": "application/json" };
  const tk = getToken();
  if (tk) headers["Authorization"] = "Bearer " + tk;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
  try { return txt ? JSON.parse(txt) : {}; } catch { return {}; }
}

// ---- AUTH ----
async function register() {
  // mapeo mínimo para evitar 422 si el select trae "resident"
  const rawRole = document.getElementById("reg-role").value;
  const role = rawRole === "resident" ? "user" : rawRole;

  const body = {
    name: document.getElementById("reg-name").value,
    email: document.getElementById("reg-email").value,
    password: document.getElementById("reg-pass").value,
    role
  };
  try {
    const data = await api("/api/auth/register", "POST", body);
    document.getElementById("reg-out").textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    document.getElementById("reg-out").textContent = e.message;
  }
}

async function login() {
  const body = {
    email: document.getElementById("log-email").value,
    password: document.getElementById("log-pass").value,
  };
  try {
    const data = await api("/api/auth/login", "POST", body);
    setToken(data.access_token);
    document.getElementById("log-out").textContent = "OK: " + JSON.stringify(data.user);
  } catch (e) {
    document.getElementById("log-out").textContent = e.message;
  }
}

// ---- AMENITIES ----
async function createAmenity() {
  const name = document.getElementById("amenity-name").value;
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

// ---- UNITS ----
async function createUnit() {
  const code = document.getElementById("unit-code").value;
  const owner_id = document.getElementById("unit-owner").value || null;
  const area_m2 = parseFloat(document.getElementById("unit-area").value || "0");
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

// ---- RESERVATIONS ----
async function createReservation() {
  const amenity_id = Number(document.getElementById("res-amenity").value);
  const user_id = Number(document.getElementById("res-user").value);
  const start_at = new Date(document.getElementById("res-start").value.replace(" ", "T") + ":00");
  const end_at = new Date(document.getElementById("res-end").value.replace(" ", "T") + ":00");
  try {
    const data = await api("/api/reservations", "POST", { amenity_id, user_id, start_at, end_at });
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

// ---- TICKETS ----
async function createTicket() {
  const body = {
    user_id: Number(document.getElementById("tk-user").value),
    unit_id: document.getElementById("tk-unit").value ? Number(document.getElementById("tk-unit").value) : null,
    title: document.getElementById("tk-title").value,
    description: document.getElementById("tk-desc").value,
  };
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

// ---- PAYMENTS ----
async function createPayment() {
  const body = {
    user_id: Number(document.getElementById("pay-user").value),
    unit_id: document.getElementById("pay-unit")?.value ? Number(document.getElementById("pay-unit").value) : null,
    amount: parseFloat(document.getElementById("pay-amount").value),
    method: document.getElementById("pay-method").value
  };
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

// ======== USERS (CRUD) ========
const USERS_PATH = "/api/users";

async function listUsers() {
  try {
    const data = await api(USERS_PATH);
    document.getElementById("users-out").textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    document.getElementById("users-out").textContent = e.message;
  }
}

async function createUser() {
  // mapeo mínimo para rol
  const rawRole = document.getElementById("usr-role").value.trim();
  const role = rawRole === "resident" ? "user" : rawRole;

  const body = {
    name: document.getElementById("usr-name").value.trim(),
    email: document.getElementById("usr-email").value.trim(),
    password: document.getElementById("usr-pass").value,
    role: role || "user",
  };
  try {
    const data = await api(USERS_PATH, "POST", body);
    document.getElementById("users-out").textContent = JSON.stringify(data, null, 2);
    await listUsers();
  } catch (e) {
    document.getElementById("users-out").textContent = e.message;
  }
}

async function updateUser() {
  const id = Number(document.getElementById("usr-id").value);
  if (!id) { document.getElementById("users-out").textContent = "Falta ID de usuario"; return; }

  const body = {};
  const name = document.getElementById("usr-name").value.trim();
  const email = document.getElementById("usr-email").value.trim();
  const password = document.getElementById("usr-pass").value;
  const role = document.getElementById("usr-role").value.trim();

  if (name) body.name = name;
  if (email) body.email = email;
  if (password) body.password = password;
  if (role) body.role = role === "resident" ? "user" : role;

  try {
    const data = await api(`${USERS_PATH}/${id}`, "PUT", body);
    document.getElementById("users-out").textContent = JSON.stringify(data, null, 2);
    await listUsers();
  } catch (e) {
    document.getElementById("users-out").textContent = e.message;
  }
}

async function deleteUser() {
  const id = Number(document.getElementById("usr-id").value);
  if (!id) { document.getElementById("users-out").textContent = "Falta ID de usuario"; return; }
  try {
    const data = await api(`${USERS_PATH}/${id}`, "DELETE");
    document.getElementById("users-out").textContent = JSON.stringify(data, null, 2);
    await listUsers();
  } catch (e) {
    document.getElementById("users-out").textContent = e.message;
  }
}

// ---- LOGOUT (única definición) ----
function logout() {
  localStorage.removeItem("village_token");
  token = null;
  document.getElementById("log-out").textContent = "Sesión cerrada";
  // opcional: limpiar paneles
  // ["users-out","amenities-out","units-out","reservations-out","tickets-out","payments-out"]
  //   .forEach(id => document.getElementById(id)?.textContent = "");
  // opcional: recargar
  // location.reload();
}

// exponemos la función para que el onclick del botón la encuentre
window.logout = logout;
