// ============================================================
//  POS-CORE.JS — Self-contained DB engine + Auth + UI for POS
//  Own copy so this system reads/debugs independently of the root
//  app and the other systems -- mirrors the hr/ module's own
//  hr-core.js. Always used one folder deep (pos/pos.html), so links
//  back to root-level pages are hardcoded '../' directly (no ROOT
//  indirection needed, unlike the shared root js/ files that have to
//  handle being loaded from more than one folder depth).
// ============================================================

// ---- GitHub token/auth banner ----
function showGithubAuthBanner(message) {
  let b = document.getElementById('gh-auth-banner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'gh-auth-banner';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#dc2626;color:#fff;padding:10px 16px;font-size:13px;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.3)';
    document.body.prepend(b);
  }
  b.innerHTML = `<span>⚠️ ${message}</span><a href="../index.html" style="color:#fff;text-decoration:underline;font-weight:700;white-space:nowrap">I-update ang GitHub Token →</a>`;
}
function hideGithubAuthBanner() {
  const b = document.getElementById('gh-auth-banner');
  if (b) b.remove();
}
function githubAuthErrorInfo(res) {
  if (res.status === 401) {
    return { kind: 'invalid', text: 'Nag-expire o hindi na valid ang GitHub Token na naka-save. Mag-set ng bagong token sa login page.' };
  }
  if (res.status === 403) {
    const remaining = res.headers?.get?.('x-ratelimit-remaining');
    if (remaining === '0') {
      const resetHeader = res.headers?.get?.('x-ratelimit-reset');
      const resetTime = resetHeader ? new Date(parseInt(resetHeader) * 1000).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : null;
      return { kind: 'ratelimit', text: 'Naabot na ang GitHub API rate limit.' + (resetTime ? ` Mag-a-reset ito ~${resetTime}.` : ' Maghintay ng ilang minuto.') };
    }
    return { kind: 'invalid', text: 'Tinanggihan ng GitHub ang Token (baka nag-expire o na-revoke). Mag-set ng bagong token sa login page.' };
  }
  return null;
}

// ============================================================
//  DB — GitHub API TXT database engine, own copy pointed at pos/db
// ============================================================
const DB = (() => {

  const cache = {};
  const shas  = {};

  function apiUrl(filename) {
    const { owner, repo, branch, dbPath } = GITHUB_CONFIG;
    return `https://api.github.com/repos/${owner}/${repo}/contents/${dbPath}/${filename}.txt`;
  }

  // Sync's cache/queue is keyed by bare dbName whenever dbPath is the
  // shared root 'db' (e.g. this page reading productsDB/accountsDB via
  // withPath('db', ...)); otherwise it's "path|dbName" -- this system's
  // own default (pos/db) always qualifies, so a Sync.flush() running
  // later from a *different* page still commits to the right folder.
  function syncKey(dbName) {
    return GITHUB_CONFIG.dbPath === 'db' ? dbName : `${GITHUB_CONFIG.dbPath}|${dbName}`;
  }

  function headers() {
    return {
      'Authorization': `token ${GITHUB_CONFIG.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }

  async function fetchRetry(url, opts, attempts = 3, delayMs = 500) {
    let lastRes;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fetch(url, opts);
        if ((res.status === 403 || res.status === 429) && i < attempts - 1) {
          lastRes = res;
          const retryAfter = parseInt(res.headers?.get?.('retry-after')) || 0;
          await new Promise(r => setTimeout(r, Math.max(delayMs, retryAfter * 1000)));
          continue;
        }
        return res;
      } catch (e) {
        if (i === attempts - 1) throw e;
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
    return lastRes;
  }

  function parseTxt(raw) {
    const lines = raw.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
    if (lines.length < 1) return [];
    const headers = lines[0].split('|').map(h => h.trim());
    return lines.slice(1).map(line => {
      const vals = line.split('|');
      const obj  = {};
      headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
      return obj;
    });
  }

  function serializeTxt(rows, headerRow) {
    if (!rows || rows.length === 0) return headerRow + '\n';
    const keys = headerRow.split('|');
    const lines = rows.map(row => keys.map(k => (row[k] ?? '')).join('|'));
    return [headerRow, ...lines].join('\n') + '\n';
  }

  async function read(dbName, forceRefresh = false) {
    if (cache[dbName] && !forceRefresh) return cache[dbName];
    try {
      const res = await fetchRetry(apiUrl(dbName), { headers: headers(), cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 404) {
          cache[dbName] = []; cache[`${dbName}_header`] = '';
          if (typeof Sync !== 'undefined') Sync.cacheSet(syncKey(dbName), [], '');
          return [];
        }
        const authErr = githubAuthErrorInfo(res);
        if (authErr) showGithubAuthBanner(authErr.text);
        throw new Error(authErr ? authErr.text : `DB read error ${res.status}: ${dbName}`);
      }
      hideGithubAuthBanner();
      const json = await res.json();
      shas[dbName]  = json.sha;
      const content = decodeURIComponent(escape(atob(json.content.replace(/\n/g, ''))));
      cache[dbName] = parseTxt(content);
      cache[`${dbName}_header`] = content.split('\n')[0];
      if (typeof Sync !== 'undefined') Sync.cacheSet(syncKey(dbName), cache[dbName], cache[`${dbName}_header`]);
      return cache[dbName];
    } catch (e) {
      if (typeof Sync !== 'undefined' && Sync.isConnectivityError(e)) {
        const local = Sync.cacheGet(syncKey(dbName));
        if (local) {
          cache[dbName] = local.rows;
          cache[`${dbName}_header`] = local.header;
          return cache[dbName];
        }
      }
      throw e;
    }
  }

  async function write(dbName, rows, description) {
    const headerRow = cache[`${dbName}_header`] || Object.keys(rows[0] || {}).join('|');
    const content = serializeTxt(rows, headerRow);
    const encoded = btoa(unescape(encodeURIComponent(content)));
    async function attempt() {
      const body = {
        message: `Update ${dbName} - ${new Date().toISOString()}`,
        content: encoded,
        sha:     shas[dbName],
        branch:  GITHUB_CONFIG.branch
      };
      const res = await fetchRetry(apiUrl(dbName), {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const authErr = githubAuthErrorInfo(res);
        if (authErr) showGithubAuthBanner(authErr.text);
        const err = await res.json().catch(() => ({}));
        const e = new Error(authErr ? authErr.text : (err.message || `DB write error ${res.status}`));
        e.status = res.status;
        throw e;
      }
      hideGithubAuthBanner();
      const json = await res.json();
      shas[dbName]  = json.content.sha;
      cache[dbName] = rows;
      if (typeof Sync !== 'undefined') Sync.cacheSet(syncKey(dbName), rows, headerRow);
      return { ok: true, queued: false };
    }
    try {
      let lastErr;
      for (let i = 0; i < 6; i++) {
        try {
          return await attempt();
        } catch (e) {
          const isShaConflict = e.status === 409 || /does not match/i.test(e.message || '');
          if (!isShaConflict) throw e;
          lastErr = e;
          if (i < 5) {
            await new Promise(r => setTimeout(r, 400 * (i + 1)));
            await read(dbName, true);
          }
        }
      }
      throw lastErr;
    } catch (e) {
      if (typeof Sync !== 'undefined' && Sync.isConnectivityError(e)) {
        cache[dbName] = rows;
        const key = syncKey(dbName);
        Sync.cacheSet(key, rows, headerRow);
        Sync.queueWrite(key, rows, headerRow, description || `Update to ${dbName}`);
        return { ok: true, queued: true };
      }
      throw e;
    }
  }

  async function forceCommit(dbName, rows, headerRow) {
    await read(dbName, true);
    cache[`${dbName}_header`] = headerRow || cache[`${dbName}_header`];
    return write(dbName, rows, '(sync)');
  }

  async function insert(dbName, newRow) {
    const rows = await read(dbName, true);
    rows.push(newRow);
    return write(dbName, rows, 'New record');
  }

  async function update(dbName, condition, updates) {
    const rows = await read(dbName, true);
    let changed = 0;
    const newRows = rows.map(row => {
      if (condition(row)) { changed++; return { ...row, ...updates }; }
      return row;
    });
    if (changed === 0) return false;
    await write(dbName, newRows, 'Record update');
    return changed;
  }

  async function remove(dbName, condition) {
    const rows = await read(dbName, true);
    const newRows = rows.filter(row => !condition(row));
    const deleted = rows.length - newRows.length;
    if (deleted === 0) return 0;
    await write(dbName, newRows, 'Record deletion');
    return deleted;
  }

  function nextId(rows, field, prefix) {
    if (rows.length === 0) return `${prefix}001`;
    const nums = rows.map(r => parseInt(r[field].replace(prefix, '')) || 0);
    const next = Math.max(...nums) + 1;
    return `${prefix}${String(next).padStart(3, '0')}`;
  }

  function search(rows, query, fields) {
    const q = query.toLowerCase();
    return rows.filter(row =>
      fields.some(f => (row[f] || '').toLowerCase().includes(q))
    );
  }

  function clearCache(dbName) {
    if (dbName) { delete cache[dbName]; delete shas[dbName]; }
    else { Object.keys(cache).forEach(k => delete cache[k]); }
  }

  // Run fn() against a different dbPath than this system's own default
  // (pos/db) -- used to reach tables shared at the root (productsDB,
  // accountsDB). Restores the default afterward regardless of outcome.
  // Never Promise.all a withPath call alongside another unwrapped DB.*
  // call -- GITHUB_CONFIG.dbPath is a single mutable global, so truly
  // concurrent calls could race. Every call site in this app already
  // awaits sequentially, which is what keeps this safe.
  async function withPath(path, fn) {
    const saved = GITHUB_CONFIG.dbPath;
    GITHUB_CONFIG.dbPath = path;
    try { return await fn(); }
    finally { GITHUB_CONFIG.dbPath = saved; }
  }

  return { read, write, insert, update, remove, forceCommit, nextId, search, parseTxt, serializeTxt, clearCache, withPath };
})();

// ============================================================
//  Auth — session/permissions, own copy (same session/token keys as
//  root so a single root login works across every system)
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

  function logout() { clearSession(); window.location.href = '../index.html'; }

  function guard(requiredSystem) {
    const user = getSession();
    if (!user) { window.location.href = '../index.html'; return null; }
    if (requiredSystem === null) return user;

    if (requiredSystem === 'superadmin') {
      if (user.role !== 'superadmin') { window.location.href = '../dashboard.html'; return null; }
      return user;
    }

    if (!canAccessSystem(user, requiredSystem)) {
      alert('You don\'t have access to this system.');
      window.location.href = '../dashboard.html';
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

  function getAccessibleSystems(user) {
    if (user.role === 'superadmin') return Object.keys(SYSTEMS);
    if (user.assigned_system === 'all') return Object.keys(SYSTEMS);
    return [user.assigned_system].filter(s => SYSTEMS[s]);
  }

  function getHomeUrl(user) {
    if (user.role === 'superadmin') return '../dashboard.html';
    const sys = user.assigned_system;
    return '../' + (SYSTEMS[sys] ? SYSTEMS[sys].file : 'dashboard.html');
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

  // No login() here -- POS never shows its own login form, only the
  // root index.html does; this copy only needs to read/guard a session
  // that login already created.
  return { logout, guard, getSession, setSession, clearSession,
           saveToken, loadToken, canAccessSystem, hasPermission,
           getAccessibleSystems, applyUIPermissions, hashPassword, getHomeUrl };
})();

// ============================================================
//  UI — shared UI utilities, own copy
// ============================================================
const UI = (() => {

  function toast(message, type = 'info', duration = 3500) {
    let c = document.getElementById('toast-container');
    if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
    const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${message}</span>`;
    c.appendChild(el);
    setTimeout(() => { el.style.opacity='0'; el.style.transform='translateX(20px)'; el.style.transition='all 0.3s'; setTimeout(()=>el.remove(),300); }, duration);
  }

  function loading(show, msg='Loading...') {
    let o = document.getElementById('loading-overlay');
    if (!o) { o=document.createElement('div'); o.id='loading-overlay'; o.className='loading-overlay'; o.innerHTML=`<div class="spinner"></div><div style="color:#94a3b8;font-size:14px">${msg}</div>`; document.body.appendChild(o); }
    o.querySelector('div:last-child').textContent = msg;
    o.classList.toggle('active', show);
  }

  function openModal(id)  { const m=document.getElementById(id); if(m) m.classList.add('active'); }
  function closeModal(id) { const m=document.getElementById(id); if(m) m.classList.remove('active'); }

  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-backdrop')) e.target.classList.remove('active');
  });

  function initTabs(containerSel) {
    document.querySelectorAll(containerSel||'.tabs').forEach(tabs => {
      tabs.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          const paneId = tab.dataset.tab;
          tabs.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
          const wrapper = tabs.closest('.tab-wrapper')||document.body;
          wrapper.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
          tab.classList.add('active');
          const pane = document.getElementById(paneId);
          if (pane) pane.classList.add('active');
        });
      });
    });
  }

  function confirm(message, onConfirm, onCancel) {
    const id = 'cfm-'+Date.now();
    const div = document.createElement('div');
    div.id=id; div.className='modal-backdrop active';
    div.innerHTML=`<div class="modal" style="max-width:400px"><div class="modal-header"><span class="modal-title">⚠️ Confirmation</span></div><p style="color:#e2e8f0;margin-bottom:24px">${message}</p><div class="modal-footer"><button class="btn btn-ghost" id="${id}-no">Cancel</button><button class="btn btn-danger" id="${id}-yes">Yes, continue</button></div></div>`;
    document.body.appendChild(div);
    document.getElementById(`${id}-yes`).onclick=()=>{div.remove();onConfirm?.();};
    document.getElementById(`${id}-no`).onclick=()=>{div.remove();onCancel?.();};
    div.addEventListener('click',e=>{if(e.target===div){div.remove();onCancel?.();}});
  }

  function peso(v)       { return '₱'+parseFloat(v||0).toLocaleString('en-PH',{minimumFractionDigits:2}); }
  function dateStr(s)    { return s?new Date(s).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}):'—'; }
  function dateTimeStr(s){ return s?new Date(s).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'}):'—'; }

  function roleBadge(role) {
    const map={superadmin:'badge-purple',admin:'badge-info',user:'badge-gray',staff:'badge-success',ojt:'badge-warning',guest:'badge-gray'};
    return `<span class="badge ${map[role]||'badge-gray'}">${role.toUpperCase()}</span>`;
  }
  function statusBadge(status) {
    const map={active:'badge-success',inactive:'badge-gray',suspended:'badge-danger',completed:'badge-success',pending:'badge-warning',cancelled:'badge-danger',approved:'badge-success',rejected:'badge-danger',present:'badge-success',absent:'badge-danger',late:'badge-warning',released:'badge-success',draft:'badge-gray','in-stock':'badge-success','low-stock':'badge-warning','out-of-stock':'badge-danger',paid:'badge-success'};
    return `<span class="badge ${map[status]||'badge-gray'}">${status}</span>`;
  }

  function buildSidebar(user, currentSystem) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const isSuperAdmin = user.role === 'superadmin';
    const systems = Auth.getAccessibleSystems(user);

    let sysItems = systems.map(s => {
      const sys = SYSTEMS[s];
      if (!sys) return '';
      const active = s === currentSystem ? 'active' : '';
      return `<a href="../${sys.file}" class="sidebar-item ${active}"><span class="icon">${sys.icon}</span>${sys.name}</a>`;
    }).join('');

    if (isSuperAdmin) {
      sysItems += `<a href="../superadmin.html" class="sidebar-item ${currentSystem==='superadmin'?'active':''}"><span class="icon">⚙️</span>SuperAdmin Panel</a>`;
    }

    let userMgmtLink = '';
    if (currentSystem && Auth.hasPermission(user, currentSystem, 'manage_users')) {
      userMgmtLink = `<hr class="sidebar-divider">
        <div class="sidebar-section"><span class="sidebar-label">Management</span></div>
        <a href="#" class="sidebar-item" onclick="openUserMgmt&&openUserMgmt();return false"><span class="icon">👥</span>User Management</a>`;
    }

    const dashLink = isSuperAdmin
      ? `<a href="../dashboard.html" class="sidebar-item ${!currentSystem?'active':''}"><span class="icon">🏠</span>Dashboard</a><hr class="sidebar-divider"><div class="sidebar-section"><span class="sidebar-label">Systems</span></div>`
      : '';

    sidebar.innerHTML = `
      <div class="sidebar-section"><span class="sidebar-label">Navigation</span></div>
      ${dashLink}
      ${sysItems}
      ${userMgmtLink}
      <hr class="sidebar-divider">
      <a href="#" class="sidebar-item" onclick="Auth.logout()"><span class="icon">🚪</span>Logout</a>`;
  }

  function buildNavbar(user, systemName) {
    const brand = document.getElementById('navbar-brand');
    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    const avEl   = document.getElementById('user-avatar');
    if (brand && systemName) brand.innerHTML += ` <span class="system-badge">${systemName}</span>`;
    if (nameEl) nameEl.textContent = user.full_name;
    if (roleEl) roleEl.textContent = user.role.toUpperCase();
    if (avEl)   avEl.textContent   = user.full_name.charAt(0).toUpperCase();
    mountSyncPill();
    mountProfileMenu(user);
  }

  function mountProfileMenu(user) {
    const chip = document.querySelector('.user-chip');
    if (!chip || document.getElementById('profile-menu')) return;
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    chip.parentNode.insertBefore(wrap, chip);
    wrap.appendChild(chip);
    chip.classList.add('clickable');
    chip.addEventListener('click', e => { e.stopPropagation(); toggleProfileMenu(); });

    const menu = document.createElement('div');
    menu.id = 'profile-menu';
    menu.className = 'profile-menu';
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    menu.innerHTML = `
      <div class="pm-header">
        <div class="pm-name">${user.full_name}</div>
        <div class="pm-role">${user.role}</div>
      </div>
      <a class="pm-item" href="../edit-profile.html">✏️ Edit Profile</a>
      <a class="pm-item" href="../change-password.html">🔑 Change Password</a>
      <div class="pm-theme-row">
        <span>🌙 Dark Mode</span>
        <label class="theme-switch">
          <input type="checkbox" id="theme-toggle-input" ${isDark?'checked':''} onchange="UI.toggleTheme(this.checked)">
          <span class="theme-switch-track"></span>
        </label>
      </div>
      <div class="pm-divider"></div>
      <button class="pm-item danger" onclick="Auth.logout()">🚪 Logout</button>
    `;
    wrap.appendChild(menu);
    document.addEventListener('click', e => {
      if (!e.target.closest('.user-chip') && !e.target.closest('#profile-menu')) closeProfileMenu();
    });
  }
  function toggleProfileMenu() {
    const m = document.getElementById('profile-menu');
    if (m) m.classList.toggle('open');
  }
  function closeProfileMenu() {
    const m = document.getElementById('profile-menu');
    if (m) m.classList.remove('open');
  }
  // Own theme key (pos_theme) -- independent from the root app's
  // ent_theme and the other systems' own keys, same independence
  // principle as the hr/ module's separate hr_theme.
  function toggleTheme(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('pos_theme', isDark ? 'dark' : 'light');
  }

  function mountSyncPill() {
    if (typeof Sync === 'undefined') return;
    const right = document.querySelector('.navbar-right');
    if (!right || document.getElementById('sync-pill')) return;
    const pill = document.createElement('div');
    pill.id = 'sync-pill';
    pill.className = 'sync-pill';
    pill.title = 'Click to sync now';
    pill.onclick = () => Sync.flush().then(r => {
      if (r.synced) toast(`Synced ${r.synced} change(s) ✅`, 'success');
      else if (!Sync.status().online) toast('Offline — will save locally first.', 'warning');
      else toast('No new changes to sync.', 'info');
    });
    right.insertBefore(pill, right.firstChild);
    renderSyncPill(Sync.status());
    document.addEventListener('ent:sync-status', e => renderSyncPill(e.detail));
  }

  function renderSyncPill(s) {
    const pill = document.getElementById('sync-pill');
    if (!pill) return;
    if (!s.online) {
      pill.className = 'sync-pill offline';
      pill.innerHTML = `🔴 Offline${s.pending ? ` <span class="sync-count">${s.pending}</span>` : ''}`;
    } else if (s.pending) {
      pill.className = 'sync-pill pending';
      pill.innerHTML = `🟡 Syncing... <span class="sync-count">${s.pending}</span>`;
    } else {
      pill.className = 'sync-pill online';
      pill.innerHTML = `🟢 Online`;
    }
  }

  function paginate(rows, page, perPage=15) {
    const total=rows.length, pages=Math.ceil(total/perPage), start=(page-1)*perPage;
    return { rows:rows.slice(start,start+perPage), total, pages, page, showing:`Showing ${start+1}–${Math.min(start+perPage,total)} of ${total}` };
  }

  function renderPagination(containerId, paged, onPage) {
    const el=document.getElementById(containerId);
    if(!el||paged.pages<=1){if(el)el.innerHTML='';return;}
    let html=`<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;margin-top:16px"><span style="color:#94a3b8;font-size:12px">${paged.showing}</span>`;
    for(let i=1;i<=paged.pages;i++){
      const a=i===paged.page?'btn-primary':'btn-ghost';
      html+=`<button class="btn btn-sm ${a}" onclick="(${onPage.toString()})(${i})">${i}</button>`;
    }
    html+='</div>';
    el.innerHTML=html;
  }

  return { toast, loading, openModal, closeModal, initTabs, confirm,
           peso, dateStr, dateTimeStr, roleBadge, statusBadge,
           buildSidebar, buildNavbar, paginate, renderPagination, toggleTheme };
})();
