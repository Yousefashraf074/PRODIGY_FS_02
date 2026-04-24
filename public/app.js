const API = '';
let accessToken = null;
let tokenParsed = null;

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(value) {
  if (!value) return '--:--';
  const date = new Date(value);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function apiFetch(url, options = {}) {
  const expiry = sessionStorage.getItem('ems_token_expiry');
  if (!accessToken || !expiry || Date.now() >= parseInt(expiry, 10)) {
    logout();
    throw new Error('Session expired');
  }

  const res = await fetch(`${API}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {})
    }
  });

  if (res.status === 401) {
    logout();
    showToast('Session expired. Please login again.', 'error');
    throw new Error('Unauthorized');
  }

  return res;
}

async function loadOverview() {
  try {
    document.getElementById('todayStatus').textContent = 'Loading...';
    document.getElementById('checkInTime').textContent = '--:--';
    document.getElementById('checkOutTime').textContent = '--:--';
    document.getElementById('historyCount').textContent = '0';
    document.getElementById('recentList').innerHTML = '<li>Loading attendance records...</li>';

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const dateQuery = new URLSearchParams({ startDate: startDate.toISOString().slice(0, 10), limit: '50' });
    const res = await apiFetch(`/api/attendance?${dateQuery}`);
    const data = await res.json();

    const records = data.attendance || [];
    const today = records.find(r => r.date === getTodayDate());
    document.getElementById('todayStatus').textContent = today ? today.status : 'Pending';
    document.getElementById('checkInTime').textContent = formatTime(today?.checkIn);
    document.getElementById('checkOutTime').textContent = formatTime(today?.checkOut);
    document.getElementById('historyCount').textContent = records.length;

    renderRecent(records.slice(0, 5));
  } catch (err) {
    if (err.message !== 'Unauthorized') showToast('Unable to load overview', 'error');
  }
}

async function loadHistory() {
  try {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    const params = new URLSearchParams({ startDate: startDate.toISOString().slice(0, 10), limit: '100' });
    const res = await apiFetch(`/api/attendance?${params}`);
    const data = await res.json();
    const rows = data.attendance || [];

    const tbody = document.getElementById('attendanceTableBody');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><i class="fas fa-calendar-times"></i><p>No attendance records found.</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(record => `
      <tr>
        <td>${record.date}</td>
        <td>${formatTime(record.checkIn)}</td>
        <td>${formatTime(record.checkOut)}</td>
        <td>${record.status}</td>
      </tr>
    `).join('');
  } catch (err) {
    if (err.message !== 'Unauthorized') showToast('Unable to load attendance history', 'error');
  }
}

function renderRecent(records) {
  const list = document.getElementById('recentList');
  if (!records.length) {
    list.innerHTML = '<li>No recent records yet.</li>';
    return;
  }

  list.innerHTML = records.map(record => `
    <li>
      <strong>${formatDate(record.date)}</strong>
      <span>${record.status}</span>
    </li>
  `).join('');
}

async function checkIn() {
  try {
    const res = await apiFetch('/api/attendance/check-in', { method: 'POST', body: JSON.stringify({ date: getTodayDate() }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Check-in failed');
    showToast('Check-in recorded', 'success');
    loadOverview();
  } catch (err) {
    showToast(err.message || 'Check-in failed', 'error');
  }
}

async function checkOut() {
  try {
    const res = await apiFetch('/api/attendance/check-out', { method: 'POST', body: JSON.stringify({ date: getTodayDate() }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Check-out failed');
    showToast('Check-out recorded', 'success');
    loadOverview();
  } catch (err) {
    showToast(err.message || 'Check-out failed', 'error');
  }
}

async function loadKeycloakConfig() {
  const statusEl = document.getElementById('kcStatus');
  const loginBtn = document.getElementById('kcLoginBtn');
  const credBox = document.getElementById('kcCredentials');

  try {
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading configuration...';
    const cfgRes = await fetch(`${API}/api/keycloak-config`);
    if (!cfgRes.ok) throw new Error('Failed to fetch config from server');
    const config = await cfgRes.json();

    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting to Keycloak...';
    const kcTestRes = await fetch(`${config.url}/realms/${config.realm}/.well-known/openid-configuration`);
    if (!kcTestRes.ok) throw new Error(`Keycloak not reachable at ${config.url}`);
    const oidcConfig = await kcTestRes.json();

    window.kcConfig = { ...config, oidc: oidcConfig };

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const storedToken = sessionStorage.getItem('ems_access_token');
    const storedExpiry = sessionStorage.getItem('ems_token_expiry');

    if (code) {
      statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Completing authentication...';
      await exchangeCodeForTokens(code, config, oidcConfig);
      window.history.replaceState({}, document.title, window.location.pathname);
      onAuthenticated();
    } else if (storedToken && storedExpiry && Date.now() < parseInt(storedExpiry, 10)) {
      accessToken = storedToken;
      tokenParsed = JSON.parse(atob(storedToken.split('.')[1]));
      onAuthenticated();
    } else {
      statusEl.innerHTML = '<i class="fas fa-shield-alt"></i> Please sign in to continue';
      statusEl.className = 'kc-status';
      loginBtn.style.display = '';
      credBox.style.display = '';
    }
  } catch (err) {
    console.error('Auth init error:', err);
    statusEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message || 'Connection failed'}`;
    statusEl.className = 'kc-status error';
    loginBtn.style.display = '';
    loginBtn.textContent = 'Retry Connection';
    loginBtn.onclick = () => window.location.reload();
  }
}

async function exchangeCodeForTokens(code, config, oidcConfig) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code: code,
    redirect_uri: window.location.origin + window.location.pathname
  });

  const res = await fetch(oidcConfig.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || err.error || 'Token exchange failed');
  }

  const tokens = await res.json();
  accessToken = tokens.access_token;
  tokenParsed = JSON.parse(atob(tokens.access_token.split('.')[1]));
  const expiresIn = tokens.expires_in || 300;
  sessionStorage.setItem('ems_access_token', accessToken);
  sessionStorage.setItem('ems_token_expiry', String(Date.now() + expiresIn * 1000));
  if (tokens.refresh_token) {
    sessionStorage.setItem('ems_refresh_token', tokens.refresh_token);
  }
}

function keycloakLogin() {
  const config = window.kcConfig;
  if (!config) {
    window.location.reload();
    return;
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: window.location.origin + window.location.pathname,
    response_type: 'code',
    scope: 'openid profile email'
  });
  window.location.href = `${config.oidc.authorization_endpoint}?${params}`;
}

function onAuthenticated() {
  showDashboard();
  showToast(`Welcome, ${tokenParsed?.preferred_username || 'User'}!`, 'success');
}

function logout() {
  sessionStorage.removeItem('ems_access_token');
  sessionStorage.removeItem('ems_token_expiry');
  sessionStorage.removeItem('ems_refresh_token');
  accessToken = null;
  tokenParsed = null;
  const config = window.kcConfig;
  if (config?.oidc?.end_session_endpoint) {
    const params = new URLSearchParams({
      post_logout_redirect_uri: window.location.origin,
      client_id: config.clientId
    });
    window.location.href = `${config.oidc.end_session_endpoint}?${params}`;
  } else {
    showAuth();
  }
}

function showAuth() {
  document.getElementById('authPage').classList.remove('hidden');
  document.getElementById('dashboard').classList.add('hidden');
}

function showDashboard() {
  document.getElementById('authPage').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  document.getElementById('adminName').textContent = tokenParsed?.preferred_username || 'Admin';
  const d = new Date();
  document.getElementById('dateDisplay').textContent = d.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  loadOverview();
  loadHistory();
}

function switchView(view, navEl) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`${view}View`).classList.add('active');
  if (navEl) navEl.classList.add('active');
  document.getElementById('pageTitle').textContent = view === 'history' ? 'Attendance History' : 'Overview';
  if (view === 'overview') loadOverview();
  if (view === 'history') loadHistory();
  document.querySelector('.sidebar').classList.remove('open');
}

function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type]}"></i> ${message}`;
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.classList.remove('show'), 3500);
}

document.addEventListener('DOMContentLoaded', loadKeycloakConfig);
