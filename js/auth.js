// ============================================================
//  AUTH.JS — Authentication & Access Control Engine
// ============================================================

const Auth = (() => {
  const SESSION_KEY = 'ent_session';
  const TOKEN_KEY   = 'ent_gh_token';

  function setSession(user) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)); }
  function getSession() { const s = sessionStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : null; }
  function clearSession() { sessionStorage.removeItem(SESSION_KEY); }
  function saveToken(t) { localStorage.setItem(TOKEN_KEY, t); GITHUB_CONFIG.token = t; }
  function loadToken() { const t = localStorage.getItem(TOKEN_KEY); if (t) GITHUB_CONFIG.token = t; return t; }

  async function hashPassword(password) {
    const data = new TextEncoder().encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  async function login(username, password) {
    try {
      const rows   = await DB.read('accountsDB');
      const hashed = await hashPassword(password);
      const user   = rows.find(r =>
        r.username === username &&
        r.password_hash === hashed &&
        r.status === 'active'
      );
      if (!user) return { success: false, message: 'Wrong username or password.' };
      const sessionUser = {
        username: user.username, full_name: user.full_name,
        role: user.role, assigned_system: user.assigned_system,
        email: user.email, employee_id: user.employee_id || '',
        login_time: new Date().toISOString()
      };
      setSession(sessionUser);
      return { success: true, user: sessionUser };
    } catch(e) {
      return { success: false, message: 'Could not read the database: ' + e.message };
    }
  }

  function logout() { clearSession(); window.location.href = _ROOT + 'index.html'; }

  // Guard — requiredSystem: null=dashboard, 'pos','inventory','attendance','budget','superadmin'
  function guard(requiredSystem) {
    const user = getSession();
    if (!user) { window.location.href = _ROOT + 'index.html'; return null; }
    if (requiredSystem === null) return user; // dashboard: just check login

    // Superadmin page
    if (requiredSystem === 'superadmin') {
      if (user.role !== 'superadmin') { window.location.href = _ROOT + 'dashboard.html'; return null; }
      return user;
    }

    if (!canAccessSystem(user, requiredSystem)) {
      alert('You don\'t have access to this system.');
      window.location.href = _ROOT + 'dashboard.html';
      return null;
    }
    return user;
  }

  function canAccessSystem(user, system) {
    if (!system) return true;
    if (user.role === 'superadmin') return true;
    if (system === 'superadmin') return user.role === 'superadmin';
    if (user.assigned_system === 'all') return true;
    return user.assigned_system === system;
  }

  function hasPermission(user, system, action) {
    if (user.role === 'superadmin') return true;
    return (PERMISSIONS[system]?.[user.role] || []).includes(action);
  }

  // What systems appear in nav/dashboard for this user
  function getAccessibleSystems(user) {
    if (user.role === 'superadmin') return Object.keys(SYSTEMS);
    if (user.assigned_system === 'all') return Object.keys(SYSTEMS);
    return [user.assigned_system].filter(s => SYSTEMS[s]);
  }

  // Returns redirect target after login based on role
  function getHomeUrl(user) {
    if (user.role === 'superadmin') return _ROOT + 'dashboard.html';
    const sys = user.assigned_system;
    return _ROOT + (SYSTEMS[sys] ? SYSTEMS[sys].file : 'dashboard.html');
  }

  function applyUIPermissions(user, system) {
    document.querySelectorAll('[data-perm]').forEach(el => {
      if (!hasPermission(user, system, el.dataset.perm)) el.style.display = 'none';
    });
    document.querySelectorAll('[data-role]').forEach(el => {
      const roles = el.dataset.role.split(',').map(r => r.trim());
      if (!roles.includes(user.role)) el.style.display = 'none';
    });
    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    const avEl   = document.getElementById('user-avatar');
    if (nameEl) nameEl.textContent = user.full_name;
    if (roleEl) roleEl.textContent = user.role.toUpperCase();
    if (avEl)   avEl.textContent   = user.full_name.charAt(0).toUpperCase();
  }

  return { login, logout, guard, getSession, setSession, clearSession,
           saveToken, loadToken, canAccessSystem, hasPermission,
           getAccessibleSystems, applyUIPermissions, hashPassword, getHomeUrl };
})();
