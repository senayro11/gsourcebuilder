// ============================================================
//  AUTH.JS — Authentication & Access Control Engine
// ============================================================

const Auth = (() => {
  const SESSION_KEY = 'ent_session';
  const TOKEN_KEY   = 'ent_gh_token';

  // --- Session ---
  function setSession(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
  function getSession() {
    const s = sessionStorage.getItem(SESSION_KEY);
    return s ? JSON.parse(s) : null;
  }
  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }
  function saveToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
    GITHUB_CONFIG.token = token;
  }
  function loadToken() {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) GITHUB_CONFIG.token = t;
    return t;
  }

  // --- Password hashing (SHA-256 via SubtleCrypto) ---
  async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // --- Login ---
  async function login(username, password) {
    try {
      const rows = await DB.read('accountsDB');
      const hashed = await hashPassword(password);
      const user = rows.find(r =>
        r.username === username &&
        r.password_hash === hashed &&
        r.status === 'active'
      );
      if (!user) return { success: false, message: 'Mali ang username o password.' };
      const sessionUser = {
        username:  user.username,
        full_name: user.full_name,
        role:      user.role,
        assigned_system: user.assigned_system,
        email:     user.email,
        login_time: new Date().toISOString()
      };
      setSession(sessionUser);
      return { success: true, user: sessionUser };
    } catch(e) {
      return { success: false, message: 'Hindi mabasag ang database: ' + e.message };
    }
  }

  // --- Logout ---
  function logout() {
    clearSession();
    window.location.href = 'index.html';
  }

  // --- Guard: call sa bawat system page ---
  // requiredSystem: 'pos' | 'inventory' | 'attendance' | 'budget' | 'users'
  function guard(requiredSystem) {
    const user = getSession();
    if (!user) { window.location.href = 'index.html'; return null; }
    if (!canAccessSystem(user, requiredSystem)) {
      alert('Wala kang access sa system na ito.');
      window.location.href = 'dashboard.html';
      return null;
    }
    return user;
  }

  // --- Access checks ---
  function canAccessSystem(user, system) {
    if (user.role === 'superadmin') return true;
    if (system === 'users') return false; // superadmin only
    if (user.assigned_system === 'all') return true;
    return user.assigned_system === system;
  }

  function hasPermission(user, system, action) {
    if (user.role === 'superadmin') return true;
    const perms = PERMISSIONS[system]?.[user.role] || [];
    return perms.includes(action);
  }

  function getAccessibleSystems(user) {
    if (user.role === 'superadmin') return Object.keys(SYSTEMS);
    if (user.assigned_system === 'all') return Object.keys(SYSTEMS).filter(s => s !== 'users');
    return [user.assigned_system];
  }

  // --- UI Helper: hide elements if no permission ---
  function applyUIPermissions(user, system) {
    document.querySelectorAll('[data-perm]').forEach(el => {
      const action = el.dataset.perm;
      if (!hasPermission(user, system, action)) {
        el.style.display = 'none';
      }
    });
    document.querySelectorAll('[data-role]').forEach(el => {
      const roles = el.dataset.role.split(',').map(r => r.trim());
      if (!roles.includes(user.role)) {
        el.style.display = 'none';
      }
    });
    // Show user info in navbar
    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    if (nameEl) nameEl.textContent = user.full_name;
    if (roleEl) roleEl.textContent = user.role.toUpperCase();
  }

  return { login, logout, guard, getSession, setSession, clearSession,
           saveToken, loadToken, canAccessSystem, hasPermission,
           getAccessibleSystems, applyUIPermissions, hashPassword };
})();
