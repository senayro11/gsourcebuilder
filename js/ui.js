// ============================================================
//  UI.JS — Shared UI Utilities
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

  function loading(show, msg='Sandali lang...') {
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
    div.innerHTML=`<div class="modal" style="max-width:400px"><div class="modal-header"><span class="modal-title">⚠️ Kumpirmasyon</span></div><p style="color:#e2e8f0;margin-bottom:24px">${message}</p><div class="modal-footer"><button class="btn btn-ghost" id="${id}-no">Kanselahin</button><button class="btn btn-danger" id="${id}-yes">Oo, ituloy</button></div></div>`;
    document.body.appendChild(div);
    document.getElementById(`${id}-yes`).onclick=()=>{div.remove();onConfirm?.();};
    document.getElementById(`${id}-no`).onclick=()=>{div.remove();onCancel?.();};
    div.addEventListener('click',e=>{if(e.target===div){div.remove();onCancel?.();}});
  }

  function peso(v)       { return '₱'+parseFloat(v||0).toLocaleString('en-PH',{minimumFractionDigits:2}); }
  function dateStr(s)    { return s?new Date(s).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}):'—'; }
  function dateTimeStr(s){ return s?new Date(s).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'}):'—'; }

  function roleBadge(role) {
    const map={superadmin:'badge-purple',admin:'badge-info',staff:'badge-success',ojt:'badge-warning',guest:'badge-gray'};
    return `<span class="badge ${map[role]||'badge-gray'}">${role.toUpperCase()}</span>`;
  }
  function statusBadge(status) {
    const map={active:'badge-success',inactive:'badge-gray',suspended:'badge-danger',completed:'badge-success',pending:'badge-warning',cancelled:'badge-danger',approved:'badge-success',rejected:'badge-danger',present:'badge-success',absent:'badge-danger',late:'badge-warning',released:'badge-success',draft:'badge-gray','in-stock':'badge-success','low-stock':'badge-warning','out-of-stock':'badge-danger',paid:'badge-success'};
    return `<span class="badge ${map[status]||'badge-gray'}">${status}</span>`;
  }

  // Build sidebar — shows only systems the user can access
  // For non-superadmin: shows their system's nav items, not all systems
  function buildSidebar(user, currentSystem) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const isSuperAdmin = user.role === 'superadmin';
    const systems = Auth.getAccessibleSystems(user);

    let sysItems = systems.map(s => {
      const sys = SYSTEMS[s];
      if (!sys) return '';
      const active = s === currentSystem ? 'active' : '';
      return `<a href="${sys.file}" class="sidebar-item ${active}"><span class="icon">${sys.icon}</span>${sys.name}</a>`;
    }).join('');

    // Superadmin gets link to superadmin panel
    if (isSuperAdmin) {
      sysItems += `<a href="superadmin.html" class="sidebar-item ${currentSystem==='superadmin'?'active':''}"><span class="icon">⚙️</span>SuperAdmin Panel</a>`;
    }

    // Per-system User Management for admins
    let userMgmtLink = '';
    if (currentSystem && Auth.hasPermission(user, currentSystem, 'manage_users')) {
      userMgmtLink = `<hr class="sidebar-divider">
        <div class="sidebar-section"><span class="sidebar-label">Management</span></div>
        <a href="#" class="sidebar-item" onclick="openUserMgmt&&openUserMgmt();return false"><span class="icon">👥</span>User Management</a>`;
    }

    // Dashboard link — only for superadmin (non-superadmin shouldn't see other systems)
    const dashLink = isSuperAdmin
      ? `<a href="dashboard.html" class="sidebar-item ${!currentSystem?'active':''}"><span class="icon">🏠</span>Dashboard</a><hr class="sidebar-divider"><div class="sidebar-section"><span class="sidebar-label">Systems</span></div>`
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
  }

  // Online/offline + pending-sync indicator sa navbar. Live-updated via
  // ang 'ent:sync-status' event na dinidispatch ng sync.js.
  function mountSyncPill() {
    if (typeof Sync === 'undefined') return;
    const right = document.querySelector('.navbar-right');
    if (!right || document.getElementById('sync-pill')) return;
    const pill = document.createElement('div');
    pill.id = 'sync-pill';
    pill.className = 'sync-pill';
    pill.title = 'I-click para i-sync ngayon';
    pill.onclick = () => Sync.flush().then(r => {
      if (r.synced) toast(`Na-sync ang ${r.synced} pagbabago ✅`, 'success');
      else if (!Sync.status().online) toast('Offline — ise-save muna lokal.', 'warning');
      else toast('Walang bagong pagbabago na i-sy-sync.', 'info');
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
      pill.innerHTML = `🟡 Sinisync... <span class="sync-count">${s.pending}</span>`;
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
           buildSidebar, buildNavbar, paginate, renderPagination };
})();
