// ============================================================
//  UI.JS — Shared UI Utilities (Toast, Modal, Loading, etc.)
// ============================================================

const UI = (() => {

  // --- Toast ---
  function toast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${message}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0'; el.style.transform = 'translateX(20px)';
      el.style.transition = 'all 0.3s';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  // --- Loading overlay ---
  function loading(show, msg = 'Sandali lang...') {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `<div class="spinner"></div><div style="color:#94a3b8;font-size:14px">${msg}</div>`;
      document.body.appendChild(overlay);
    }
    overlay.querySelector('div:last-child').textContent = msg;
    overlay.classList.toggle('active', show);
  }

  // --- Modal ---
  function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('active');
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
  }
  // Close modal on backdrop click
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-backdrop')) {
      e.target.classList.remove('active');
    }
  });

  // --- Tabs ---
  function initTabs(containerSel) {
    const containers = document.querySelectorAll(containerSel || '.tabs');
    containers.forEach(tabs => {
      tabs.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          const paneId = tab.dataset.tab;
          // Deactivate all tabs & panes in same parent
          const parent = tabs.closest('.tab-wrapper') || document.body;
          tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          parent.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
          tab.classList.add('active');
          const pane = document.getElementById(paneId);
          if (pane) pane.classList.add('active');
        });
      });
    });
  }

  // --- Confirm dialog ---
  function confirm(message, onConfirm, onCancel) {
    const id = 'confirm-modal-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'modal-backdrop active';
    div.innerHTML = `
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <span class="modal-title">⚠️ Kumpirmasyon</span>
        </div>
        <p style="color:#e2e8f0;margin-bottom:24px">${message}</p>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="${id}-cancel">Kanselahin</button>
          <button class="btn btn-danger" id="${id}-ok">Oo, ituloy</button>
        </div>
      </div>`;
    document.body.appendChild(div);
    document.getElementById(`${id}-ok`).onclick = () => { div.remove(); onConfirm?.(); };
    document.getElementById(`${id}-cancel`).onclick = () => { div.remove(); onCancel?.(); };
    div.addEventListener('click', e => { if (e.target === div) { div.remove(); onCancel?.(); } });
  }

  // --- Format helpers ---
  function peso(amount) {
    return '₱' + parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
  }
  function dateStr(isoStr) {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' });
  }
  function dateTimeStr(isoStr) {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleString('en-PH', { dateStyle:'medium', timeStyle:'short' });
  }
  function roleBadge(role) {
    const map = {
      superadmin: 'badge-purple',
      admin:      'badge-info',
      staff:      'badge-success',
      ojt:        'badge-warning',
      guest:      'badge-gray'
    };
    return `<span class="badge ${map[role]||'badge-gray'}">${role.toUpperCase()}</span>`;
  }
  function statusBadge(status) {
    const map = {
      active: 'badge-success', inactive: 'badge-gray', suspended: 'badge-danger',
      completed: 'badge-success', pending: 'badge-warning', cancelled: 'badge-danger',
      approved: 'badge-success', rejected: 'badge-danger',
      present: 'badge-success', absent: 'badge-danger', late: 'badge-warning',
      released: 'badge-success', draft: 'badge-gray',
      'in-stock': 'badge-success', 'low-stock': 'badge-warning', 'out-of-stock': 'badge-danger'
    };
    return `<span class="badge ${map[status]||'badge-gray'}">${status}</span>`;
  }

  // --- Sidebar builder ---
  function buildSidebar(user, currentSystem) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const systems = Auth.getAccessibleSystems(user);
    const sysItems = systems.map(s => {
      const sys = SYSTEMS[s];
      if (!sys) return '';
      const active = s === currentSystem ? 'active' : '';
      return `<a href="${sys.file}" class="sidebar-item ${active}">
        <span class="icon">${sys.icon}</span>${sys.name}
      </a>`;
    }).join('');
    sidebar.innerHTML = `
      <div class="sidebar-section"><span class="sidebar-label">Navigation</span></div>
      <a href="dashboard.html" class="sidebar-item ${!currentSystem?'active':''}">
        <span class="icon">🏠</span>Dashboard
      </a>
      <hr class="sidebar-divider">
      <div class="sidebar-section"><span class="sidebar-label">Systems</span></div>
      ${sysItems}
      <hr class="sidebar-divider">
      <a href="#" class="sidebar-item" onclick="Auth.logout()">
        <span class="icon">🚪</span>Logout
      </a>
    `;
  }

  // --- Navbar builder ---
  function buildNavbar(user, systemName) {
    const brand = document.getElementById('navbar-brand');
    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    const avatarEl = document.getElementById('user-avatar');
    if (brand && systemName) {
      brand.innerHTML += ` <span class="system-badge">${systemName}</span>`;
    }
    if (nameEl) nameEl.textContent = user.full_name;
    if (roleEl) roleEl.textContent = user.role.toUpperCase();
    if (avatarEl) avatarEl.textContent = user.full_name.charAt(0).toUpperCase();
  }

  // --- Pagination ---
  function paginate(rows, page, perPage = 15) {
    const total = rows.length;
    const pages = Math.ceil(total / perPage);
    const start = (page - 1) * perPage;
    return {
      rows: rows.slice(start, start + perPage),
      total, pages, page,
      showing: `Showing ${start+1}–${Math.min(start+perPage, total)} of ${total}`
    };
  }

  function renderPagination(containerId, paged, onPage) {
    const el = document.getElementById(containerId);
    if (!el || paged.pages <= 1) { if(el) el.innerHTML=''; return; }
    let html = `<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;margin-top:16px">
      <span style="color:#94a3b8;font-size:12px">${paged.showing}</span>`;
    for (let i = 1; i <= paged.pages; i++) {
      const active = i === paged.page ? 'btn-primary' : 'btn-ghost';
      html += `<button class="btn btn-sm ${active}" onclick="(${onPage.toString()})(${i})">${i}</button>`;
    }
    html += '</div>';
    el.innerHTML = html;
  }

  return { toast, loading, openModal, closeModal, initTabs, confirm,
           peso, dateStr, dateTimeStr, roleBadge, statusBadge,
           buildSidebar, buildNavbar, paginate, renderPagination };
})();
