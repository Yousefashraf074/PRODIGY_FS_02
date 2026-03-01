// ============ STATE ============
const API = '';  // same-origin
let keycloak = null;
let accessToken = null;
let tokenParsed = null;
let currentSort = { by: 'id', order: 'DESC' };
let currentPage = 1;
let searchTimeout;

// ============ KEYCLOAK INIT ============
document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('kcStatus');
  const loginBtn = document.getElementById('kcLoginBtn');
  const credBox = document.getElementById('kcCredentials');

  try {
    // Fetch Keycloak config from backend
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading configuration...';
    const cfgRes = await fetch(`${API}/api/keycloak-config`);
    if (!cfgRes.ok) throw new Error('Failed to fetch config from server');
    const config = await cfgRes.json();
    console.log('Config loaded:', config);

    // Test Keycloak connectivity
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting to Keycloak...';
    const kcTestRes = await fetch(`${config.url}/realms/${config.realm}/.well-known/openid-configuration`);
    if (!kcTestRes.ok) throw new Error(`Keycloak not reachable at ${config.url}`);
    const oidcConfig = await kcTestRes.json();
    console.log('Keycloak OIDC config loaded');

    // Store config globally for manual OIDC flow
    window.kcConfig = { ...config, oidc: oidcConfig };

    // Check for auth callback (code in URL)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      // Exchange code for tokens
      statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Completing authentication...';
      await exchangeCodeForTokens(code, config, oidcConfig);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      onAuthenticated();
    } else {
      // Check for existing session
      const storedToken = sessionStorage.getItem('ems_access_token');
      const storedExpiry = sessionStorage.getItem('ems_token_expiry');
      
      if (storedToken && storedExpiry && Date.now() < parseInt(storedExpiry)) {
        accessToken = storedToken;
        tokenParsed = JSON.parse(atob(storedToken.split('.')[1]));
        onAuthenticated();
      } else {
        // Show login button
        sessionStorage.removeItem('ems_access_token');
        sessionStorage.removeItem('ems_token_expiry');
        statusEl.innerHTML = '<i class="fas fa-shield-alt"></i> Please sign in to continue';
        statusEl.className = 'kc-status';
        loginBtn.style.display = '';
        credBox.style.display = '';
      }
    }

  } catch (err) {
    console.error('Auth init error:', err);
    statusEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message || 'Connection failed'}`;
    statusEl.className = 'kc-status error';
    loginBtn.style.display = '';
    loginBtn.textContent = 'Retry Connection';
    loginBtn.onclick = () => window.location.reload();
  }
});

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
    body: body
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || err.error || 'Token exchange failed');
  }

  const tokens = await res.json();
  accessToken = tokens.access_token;
  tokenParsed = JSON.parse(atob(tokens.access_token.split('.')[1]));
  
  // Store in session
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
  showToast(`Welcome, ${tokenParsed?.preferred_username || 'Admin'}!`, 'success');
}

// ============ AUTH ============
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

  const username = tokenParsed?.preferred_username || 'Admin';
  document.getElementById('adminName').textContent = username;

  // Set date display
  const d = new Date();
  document.getElementById('dateDisplay').textContent = d.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  switchView('overview', document.querySelector('[data-view="overview"]'));
}

// ============ NAVIGATION ============
function switchView(view, navEl) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(view + 'View').classList.add('active');
  if (navEl) navEl.classList.add('active');

  const titles = { overview: 'Overview', employees: 'Employees', addEmployee: 'Add Employee' };
  document.getElementById('pageTitle').textContent = titles[view] || 'Dashboard';

  if (view === 'overview') loadStats();
  if (view === 'employees') loadEmployees();
  if (view === 'addEmployee') resetForm();

  // Close sidebar on mobile
  document.querySelector('.sidebar').classList.remove('open');
}

function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
}

// ============ API HELPER ============
async function apiFetch(url, options = {}) {
  // Check token validity
  const expiry = sessionStorage.getItem('ems_token_expiry');
  if (!accessToken || !expiry || Date.now() >= parseInt(expiry)) {
    logout();
    throw new Error('Session expired');
  }

  const res = await fetch(`${API}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
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

// ============ OVERVIEW / STATS ============
async function loadStats() {
  try {
    const res = await apiFetch('/api/employees/stats');
    const data = await res.json();

    document.getElementById('statTotal').textContent = data.total;
    document.getElementById('statActive').textContent = data.active;
    document.getElementById('statDepts').textContent = data.departments;
    document.getElementById('statSalary').textContent = '$' + data.avgSalary.toLocaleString();

    renderBarChart(data.byDepartment);
    renderDonutChart(data.byStatus, data.total);
  } catch (err) {
    if (err.message !== 'Unauthorized') showToast('Failed to load stats', 'error');
  }
}

function renderBarChart(deptData) {
  const container = document.getElementById('deptChart');
  if (!deptData.length) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No data yet</p>';
    return;
  }
  const max = Math.max(...deptData.map(d => d.count));
  container.innerHTML = deptData.map(d => `
    <div class="bar-item">
      <span class="bar-label">${d.department}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${(d.count / max) * 100}%">${d.count}</div>
      </div>
    </div>
  `).join('');
}

function renderDonutChart(statusData, total) {
  const container = document.getElementById('statusChart');
  if (!statusData.length || total === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No data yet</p>';
    return;
  }

  const colors = { Active: '#10b981', Inactive: '#ef4444', 'On Leave': '#f59e0b' };
  let offset = 0;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  let circles = '';
  let legend = '';
  statusData.forEach(s => {
    const pct = s.count / total;
    const dashLength = pct * circumference;
    circles += `<circle cx="80" cy="80" r="${radius}" fill="none" stroke="${colors[s.status] || '#6366f1'}"
      stroke-width="18" stroke-dasharray="${dashLength} ${circumference - dashLength}"
      stroke-dashoffset="${-offset}" transform="rotate(-90, 80, 80)" />`;
    offset += dashLength;
    legend += `<div class="legend-item">
      <span class="legend-dot" style="background:${colors[s.status] || '#6366f1'}"></span>
      <span>${s.status}</span>
      <span class="legend-count">${s.count}</span>
    </div>`;
  });

  container.innerHTML = `
    <svg class="donut-svg" viewBox="0 0 160 160">${circles}
      <text x="80" y="80" text-anchor="middle" dy="0.35em" fill="white" font-size="22" font-weight="700">${total}</text>
    </svg>
    <div class="donut-legend">${legend}</div>
  `;
}

// ============ EMPLOYEES TABLE ============
async function loadEmployees() {
  try {
    const search = document.getElementById('searchInput').value.trim();
    const department = document.getElementById('filterDept').value;
    const status = document.getElementById('filterStatus').value;

    const params = new URLSearchParams({
      page: currentPage,
      limit: 10,
      sortBy: currentSort.by,
      order: currentSort.order
    });
    if (search) params.set('search', search);
    if (department) params.set('department', department);
    if (status) params.set('status', status);

    const res = await apiFetch(`/api/employees?${params}`);
    const data = await res.json();

    renderTable(data.employees);
    renderPagination(data.pagination);
    loadDepartmentFilter();
  } catch (err) {
    if (err.message !== 'Unauthorized') showToast('Failed to load employees', 'error');
  }
}

function renderTable(employees) {
  const tbody = document.getElementById('employeeTableBody');
  if (!employees.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
      <i class="fas fa-users-slash"></i><p>No employees found</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = employees.map(e => `
    <tr>
      <td>${e.id}</td>
      <td><strong>${e.first_name} ${e.last_name}</strong></td>
      <td>${e.email}</td>
      <td>${e.department}</td>
      <td>${e.position}</td>
      <td>$${Number(e.salary).toLocaleString()}</td>
      <td><span class="status-badge status-${e.status}">${e.status}</span></td>
      <td>
        <div class="actions-cell">
          <button class="btn-icon edit" title="Edit" onclick="editEmployee(${e.id})"><i class="fas fa-pen"></i></button>
          <button class="btn-icon delete" title="Delete" onclick="confirmDelete(${e.id})"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderPagination(pg) {
  const container = document.getElementById('pagination');
  if (pg.totalPages <= 1) { container.innerHTML = ''; return; }

  let html = `<button class="page-btn" onclick="goToPage(${pg.page - 1})" ${pg.page === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
  for (let i = 1; i <= pg.totalPages; i++) {
    if (i === 1 || i === pg.totalPages || (i >= pg.page - 1 && i <= pg.page + 1)) {
      html += `<button class="page-btn ${i === pg.page ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    } else if (i === pg.page - 2 || i === pg.page + 2) {
      html += `<span style="color:var(--text-muted)">...</span>`;
    }
  }
  html += `<button class="page-btn" onclick="goToPage(${pg.page + 1})" ${pg.page === pg.totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
  container.innerHTML = html;
}

function goToPage(p) { currentPage = p; loadEmployees(); }

function sortTable(col) {
  if (currentSort.by === col) {
    currentSort.order = currentSort.order === 'ASC' ? 'DESC' : 'ASC';
  } else {
    currentSort.by = col;
    currentSort.order = 'ASC';
  }
  currentPage = 1;
  loadEmployees();
}

function debounceSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => { currentPage = 1; loadEmployees(); }, 300);
}

async function loadDepartmentFilter() {
  try {
    const res = await apiFetch('/api/employees?limit=1000');
    const data = await res.json();
    const depts = [...new Set(data.employees.map(e => e.department))].sort();
    const select = document.getElementById('filterDept');
    const current = select.value;
    select.innerHTML = '<option value="">All Departments</option>' + depts.map(d =>
      `<option value="${d}" ${d === current ? 'selected' : ''}>${d}</option>`
    ).join('');
  } catch (e) { /* skip */ }
}

// ============ EMPLOYEE FORM (CREATE / UPDATE) ============
async function handleEmployeeSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editEmployeeId').value;
  const payload = {
    first_name: document.getElementById('empFirstName').value.trim(),
    last_name: document.getElementById('empLastName').value.trim(),
    email: document.getElementById('empEmail').value.trim(),
    phone: document.getElementById('empPhone').value.trim() || null,
    department: document.getElementById('empDepartment').value,
    position: document.getElementById('empPosition').value.trim(),
    salary: parseFloat(document.getElementById('empSalary').value),
    hire_date: document.getElementById('empHireDate').value,
    status: document.getElementById('empStatus').value
  };

  try {
    const res = await apiFetch(id ? `/api/employees/${id}` : '/api/employees', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.errors?.join(', '));

    showToast(data.message, 'success');
    resetForm();
    switchView('employees', document.querySelector('[data-view="employees"]'));
  } catch (err) {
    showToast(err.message || 'Failed to save employee', 'error');
  }
}

async function editEmployee(id) {
  try {
    const res = await apiFetch(`/api/employees/${id}`);
    const emp = await res.json();
    if (!res.ok) throw new Error(emp.error);

    document.getElementById('editEmployeeId').value = emp.id;
    document.getElementById('empFirstName').value = emp.first_name;
    document.getElementById('empLastName').value = emp.last_name;
    document.getElementById('empEmail').value = emp.email;
    document.getElementById('empPhone').value = emp.phone || '';
    document.getElementById('empDepartment').value = emp.department;
    document.getElementById('empPosition').value = emp.position;
    document.getElementById('empSalary').value = emp.salary;
    document.getElementById('empHireDate').value = emp.hire_date;
    document.getElementById('empStatus').value = emp.status;

    document.getElementById('formTitle').innerHTML = '<i class="fas fa-user-edit"></i> Edit Employee';
    document.getElementById('formSubmitBtn').innerHTML = '<i class="fas fa-save"></i> Update Employee';
    document.getElementById('pageTitle').textContent = 'Edit Employee';

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('addEmployeeView').classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  } catch (err) {
    showToast(err.message || 'Failed to load employee', 'error');
  }
}

function resetForm() {
  document.getElementById('employeeForm').reset();
  document.getElementById('editEmployeeId').value = '';
  document.getElementById('formTitle').innerHTML = '<i class="fas fa-user-plus"></i> Add New Employee';
  document.getElementById('formSubmitBtn').innerHTML = '<i class="fas fa-save"></i> Save Employee';
}

// ============ DELETE ============
let deleteId = null;

function confirmDelete(id) {
  deleteId = id;
  document.getElementById('deleteModal').classList.add('show');
  document.getElementById('confirmDeleteBtn').onclick = () => deleteEmployee();
}

function closeModal() {
  document.getElementById('deleteModal').classList.remove('show');
  deleteId = null;
}

async function deleteEmployee() {
  if (!deleteId) return;
  try {
    const res = await apiFetch(`/api/employees/${deleteId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(data.message, 'success');
    closeModal();
    loadEmployees();
    loadStats();
  } catch (err) {
    showToast(err.message || 'Failed to delete', 'error');
    closeModal();
  }
}

// ============ TOAST ============
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type]}"></i> ${message}`;
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.classList.remove('show'), 3500);
}
