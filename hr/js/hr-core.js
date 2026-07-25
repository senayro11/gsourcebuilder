// ============================================================
//  HR-CORE.JS — Shared utilities for HR system
// ============================================================

// Safety net — kung may na-miss na try/catch kahit saan sa page (hal. isang
// init function na walang error handling), ipapakita pa rin ito bilang toast
// sa halip na tahimik lang na mananatiling naka-"Loading..." ang section.
// Naka-guard ito (errorHandlerBusy) para hindi ito ang gumawa ng sarili
// nitong infinite loop kung sakaling mag-error din ang Toast.show() mismo.
let errorHandlerBusy = false;
function reportUncaught(prefix, message, stack) {
  if (errorHandlerBusy) return;
  errorHandlerBusy = true;
  try {
    // Kunin ang unang stack frame na may pangalan ng function — dito
    // pinaka-madalas makikita kung saang function nag-uumpisa ang paulit-ulit
    // na tawag kapag "Maximum call stack size exceeded".
    const frames = (stack || '').split('\n').slice(0, 4).map(l => l.trim()).filter(Boolean);
    const detail = frames.length ? ' | ' + frames.join(' < ') : '';
    Toast.show(prefix + ': ' + message + detail, 'error', 12000);
  } finally {
    setTimeout(() => { errorHandlerBusy = false; }, 500);
  }
}
window.addEventListener('error', e => {
  reportUncaught('JS Error', e.error?.message || e.message || 'unknown', e.error?.stack);
});
window.addEventListener('unhandledrejection', e => {
  reportUncaught('Promise Error', e.reason?.message || e.reason || 'unknown', e.reason?.stack);
});

// ---- Toast ----
const Toast = {
  show(msg, type = 'info', dur = 3500) {
    let c = document.getElementById('toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toast-container';
      document.body.appendChild(c);
    }
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
    c.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'all .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      setTimeout(() => el.remove(), 300);
    }, dur);
  }
};

// ---- Loading ----
const Loading = {
  show(msg = 'Loading...') {
    let o = document.getElementById('global-loading');
    if (o) {
      o.querySelector('div:last-child').textContent = msg;
      o.classList.add('active');
    }
  },
  hide() {
    const o = document.getElementById('global-loading');
    if (o) o.classList.remove('active');
  }
};

// ---- Modal ----
const Modal = {
  open(id)  { const m = document.getElementById(id); if (m) m.classList.add('active'); },
  close(id) { const m = document.getElementById(id); if (m) m.classList.remove('active'); },
  confirm(msg, onYes, onNo) {
    const id = 'cfm-' + Date.now();
    const d = document.createElement('div');
    d.id = id;
    d.className = 'modal-backdrop active';
    d.innerHTML = `
      <div class="modal" style="max-width:400px">
        <div class="modal-header"><span class="modal-title">⚠️ Kumpirmasyon</span></div>
        <div class="modal-body"><p style="color:var(--text)">${msg}</p></div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="${id}-no">Kanselahin</button>
          <button class="btn btn-danger" id="${id}-yes">Oo, ituloy</button>
        </div>
      </div>`;
    document.body.appendChild(d);
    document.getElementById(`${id}-yes`).onclick = () => { d.remove(); onYes?.(); };
    document.getElementById(`${id}-no`).onclick  = () => { d.remove(); onNo?.(); };
    d.addEventListener('click', e => { if (e.target === d) { d.remove(); onNo?.(); } });
  }
};

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) e.target.classList.remove('active');
});

// ---- Tabs ----
function initTabs() {
  document.querySelectorAll('.tab-bar').forEach(bar => {
    bar.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const panelId = btn.dataset.tab;
        bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const wrapper = bar.closest('.tab-wrapper') || document;
        wrapper.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const panel = wrapper.querySelector('#' + panelId);
        if (panel) panel.classList.add('active');
      });
    });
  });
}

// ---- Format helpers ----
const Fmt = {
  peso(v)    { return '₱' + parseFloat(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 }); },
  date(s)    { return s ? new Date(s + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; },
  hours(h)   { return parseFloat(h || 0).toFixed(2) + ' hrs'; },
  roleBadge(r) {
    const m = { admin: 'badge-blue', staff: 'badge-success', ojt: 'badge-warning', guest: 'badge-gray', superadmin: 'badge-purple' };
    return `<span class="badge ${m[r] || 'badge-gray'}">${(r || '').toUpperCase()}</span>`;
  },
  statusBadge(s) {
    const m = {
      approved: 'badge-success', present: 'badge-success', active: 'badge-success', released: 'badge-success',
      pending: 'badge-warning', late: 'badge-warning', new: 'badge-info',
      absent: 'badge-danger', rejected: 'badge-danger', inactive: 'badge-gray', suspended: 'badge-gray', draft: 'badge-gray'
    };
    return `<span class="badge ${m[s] || 'badge-gray'}">${s || ''}</span>`;
  },
  avatarHtml(name, size = '32') {
    const initials = (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#4f8ef7,#a855f7);display:inline-flex;align-items:center;justify-content:center;font-size:${Math.round(size / 2.5)}px;font-weight:700;color:white;flex-shrink:0">${initials}</div>`;
  }
};

// ---- Pagination ----
function paginate(rows, page, perPage = 15) {
  const total = rows.length;
  const pages = Math.ceil(total / perPage) || 1;
  const start = (page - 1) * perPage;
  return {
    rows: rows.slice(start, start + perPage),
    total, pages, page, start,
    showing: `${Math.min(start + 1, total)}–${Math.min(start + perPage, total)} of ${total}`
  };
}

function renderPager(elId, paged, onPage) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (paged.pages <= 1) { el.innerHTML = ''; return; }
  let h = `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;flex-wrap:wrap;gap:8px">
    <span style="font-size:12px;color:var(--text3)">Showing ${paged.showing}</span>
    <div style="display:flex;gap:4px">`;
  if (paged.page > 1)
    h += `<button class="btn btn-ghost btn-sm" onclick="(${onPage.toString()})(${paged.page - 1})">‹</button>`;
  for (let i = Math.max(1, paged.page - 2); i <= Math.min(paged.pages, paged.page + 2); i++)
    h += `<button class="btn ${i === paged.page ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="(${onPage.toString()})(${i})">${i}</button>`;
  if (paged.page < paged.pages)
    h += `<button class="btn btn-ghost btn-sm" onclick="(${onPage.toString()})(${paged.page + 1})">›</button>`;
  h += '</div></div>';
  el.innerHTML = h;
}

// ============================================================
//  SIDEBAR — Simple, reliable toggle
//  Desktop default: OPEN (sidebar visible, content shifted right)
//  Mobile default:  CLOSED (sidebar hidden off-screen)
// ============================================================
function initSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const topbar   = document.getElementById('topbar');
  const mainEl   = document.getElementById('main-content');
  const overlay  = document.getElementById('sidebar-overlay');

  const MOBILE_BP = 1024; // breakpoint in px
  let sidebarOpen = false;

  function isMobile() {
    return window.innerWidth <= MOBILE_BP;
  }

  function applyOpen() {
    sidebarOpen = true;
    sidebar.classList.add('sb-open');
    if (isMobile()) {
      // Mobile: slide over content, show overlay
      overlay.classList.add('sb-visible');
    } else {
      // Desktop: push content right
      topbar.classList.add('sb-pushed');
      mainEl.classList.add('sb-pushed');
    }
  }

  function applyClose() {
    sidebarOpen = false;
    sidebar.classList.remove('sb-open');
    overlay.classList.remove('sb-visible');
    topbar.classList.remove('sb-pushed');
    mainEl.classList.remove('sb-pushed');
  }

  function toggle() {
    if (sidebarOpen) applyClose();
    else applyOpen();
  }

  // Set initial state based on screen size
  if (isMobile()) {
    applyClose();
  } else {
    applyOpen();
  }

  // Wire up all toggle buttons
  document.querySelectorAll('.sidebar-toggle-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggle();
    });
  });

  // Close when overlay is clicked (mobile)
  if (overlay) {
    overlay.addEventListener('click', () => applyClose());
  }

  // Handle window resize
  let lastWasMobile = isMobile();
  window.addEventListener('resize', () => {
    const nowMobile = isMobile();
    if (nowMobile === lastWasMobile) return; // no breakpoint crossing
    lastWasMobile = nowMobile;

    if (nowMobile) {
      // Switched to mobile — close sidebar, remove desktop push classes
      applyClose();
    } else {
      // Switched to desktop — open sidebar by default
      applyOpen();
    }
  });
}

// ---- Nav accordion ----
function initNavAccordion() {
  document.querySelectorAll('.nav-parent').forEach(item => {
    item.addEventListener('click', () => {
      const sub = item.nextElementSibling;
      if (!sub || !sub.classList.contains('nav-sub')) return;
      item.classList.toggle('open');
      sub.classList.toggle('open');
    });
  });
}

// ---- Active nav ----
function setActiveNav(pageId) {
  document.querySelectorAll('.nav-sub-item, .nav-item[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageId);
  });
  // Auto-open parent group
  document.querySelectorAll('.nav-parent').forEach(parent => {
    const sub = parent.nextElementSibling;
    if (sub && sub.querySelector(`[data-page="${pageId}"]`)) {
      parent.classList.add('open');
      sub.classList.add('open');
    }
  });
}

// ---- Clock ----
function startClock(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  function tick() {
    const now = new Date();
    el.textContent =
      now.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) +
      '  ' +
      now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  }
  tick();
  setInterval(tick, 1000);
}

// ============================================================
//  HRDB — GitHub API TXT database engine
// ============================================================
const HRDB = (() => {
  const cache = {}, shas = {};

  function apiUrl(name) {
    const { owner, repo, branch, dbPath } = GITHUB_CONFIG;
    return `https://api.github.com/repos/${owner}/${repo}/contents/${dbPath}/${name}.txt`;
  }

  function hdrs() {
    return {
      'Authorization': `token ${GITHUB_CONFIG.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }

  // Ilang beses subukan bago mag-give up. Dalawang klase ng transient
  // failure ang hina-handle dito: (1) flaky mobile data — fetch() mismo ang
  // nag-tha-throw; (2) GitHub secondary rate limit (403) o 429 — hindi ito
  // totoong "invalid" na error, sandaling paghinto lang bago tuloy ulit.
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

  function parse(raw) {
    const lines = raw.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
    if (!lines.length) return [];
    const heads = lines[0].split('|').map(h => h.trim());
    return lines.slice(1).map(line => {
      const vals = line.split('|');
      const obj = {};
      heads.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
      return obj;
    });
  }

  function serialize(rows, header) {
    if (!rows || !rows.length) return header + '\n';
    const keys = header.split('|');
    return [header, ...rows.map(r => keys.map(k => r[k] ?? '').join('|'))].join('\n') + '\n';
  }

  // 'hr_' prefix sa Sync cache/queue keys para hindi mag-collide sa mga
  // parehong-pangalang dbName ng root app (hal. root's db/employeesDB.txt
  // vs hr/db/employeesDB.txt — magkaiba ang laman kahit parehong pangalan).
  function syncKey(name) { return 'hr_' + name; }

  async function read(name, force = false) {
    if (cache[name] && !force) return cache[name];
    try {
      const res = await fetchRetry(apiUrl(name), { headers: hdrs() });
      if (!res.ok) {
        if (res.status === 404) {
          cache[name] = []; cache[`${name}_header`] = '';
          if (typeof Sync !== 'undefined') Sync.cacheSet(syncKey(name), [], '');
          return [];
        }
        throw new Error(`DB read error ${res.status}: ${name}`);
      }
      const json = await res.json();
      shas[name] = json.sha;
      const content = atob(json.content.replace(/\n/g, ''));
      cache[name] = parse(content);
      cache[`${name}_header`] = content.split('\n')[0];
      if (typeof Sync !== 'undefined') Sync.cacheSet(syncKey(name), cache[name], cache[`${name}_header`]);
      return cache[name];
    } catch (e) {
      if (typeof Sync !== 'undefined' && Sync.isConnectivityError(e)) {
        const local = Sync.cacheGet(syncKey(name));
        if (local) {
          cache[name] = local.rows;
          cache[`${name}_header`] = local.header;
          return cache[name];
        }
      }
      throw e;
    }
  }

  async function write(name, rows, description) {
    const header = cache[`${name}_header`] || Object.keys(rows[0] || {}).join('|');
    try {
      const content = serialize(rows, header);
      const encoded = btoa(unescape(encodeURIComponent(content)));
      const body = {
        message: `Update ${name} - ${new Date().toISOString()}`,
        content: encoded,
        sha: shas[name],
        branch: GITHUB_CONFIG.branch
      };
      const res = await fetchRetry(apiUrl(name), {
        method: 'PUT',
        headers: hdrs(),
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.message || `DB write error ${res.status}`);
      }
      const json = await res.json();
      shas[name] = json.content.sha;
      cache[name] = rows;
      if (typeof Sync !== 'undefined') Sync.cacheSet(syncKey(name), rows, header);
      return { ok: true, queued: false };
    } catch (e) {
      if (typeof Sync !== 'undefined' && Sync.isConnectivityError(e)) {
        cache[name] = rows;
        Sync.cacheSet(syncKey(name), rows, header);
        Sync.queueWrite(syncKey(name), rows, header, description || `Update sa ${name}`);
        return { ok: true, queued: true };
      }
      throw e;
    }
  }

  // Ginagamit ni Sync.flush() lang para i-commit ang isang naka-queue na
  // pagbabago gamit ang fresh sha mula sa GitHub.
  async function forceCommit(name, rows, header) {
    await read(name, true);
    cache[`${name}_header`] = header || cache[`${name}_header`];
    return write(name, rows, '(sync)');
  }

  async function insert(name, row) {
    const rows = await read(name, true);
    rows.push(row);
    return write(name, rows, 'Bagong record');
  }

  async function update(name, cond, updates) {
    const rows = await read(name, true);
    let n = 0;
    const newRows = rows.map(r => {
      if (cond(r)) { n++; return { ...r, ...updates }; }
      return r;
    });
    if (!n) return 0;
    await write(name, newRows, 'Pag-update ng record');
    return n;
  }

  async function remove(name, cond) {
    const rows = await read(name, true);
    const newRows = rows.filter(r => !cond(r));
    if (newRows.length === rows.length) return 0;
    await write(name, newRows, 'Pagtanggal ng record');
    return rows.length - newRows.length;
  }

  function nextId(rows, field, prefix) {
    if (!rows.length) return `${prefix}001`;
    const nums = rows.map(r => parseInt((r[field] || '').replace(prefix, '')) || 0);
    return `${prefix}${String(Math.max(...nums) + 1).padStart(3, '0')}`;
  }

  function clearCache(name) {
    if (name) { delete cache[name]; delete shas[name]; }
    else { Object.keys(cache).forEach(k => delete cache[k]); }
  }

  return { read, write, insert, update, remove, forceCommit, nextId, clearCache };
})();

// ============================================================
//  BREAK SCHEDULE — per-employee na configurable break windows
//  (AM/Lunch/PM), ginagamit ng kiosk (timein.html) at ng Attendance/
//  Schedule pages (attendance.html). Bawat break ay pwedeng i-on/off,
//  at ang oras/tagal ay editable per employee sa schedulesDB.
// ============================================================
const BREAK_TYPES = [
  { key: 'am_break',    label: 'AM Break',    icon: '☕', defaultStart: '10:00', defaultEnd: '10:15' },
  { key: 'lunch_break', label: 'Lunch Break', icon: '🍽️', defaultStart: '12:00', defaultEnd: '13:00' },
  { key: 'pm_break',    label: 'PM Break',    icon: '☕', defaultStart: '15:00', defaultEnd: '15:15' }
];

function timeToMin(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (m || 0);
}

// Piliin ang schedule row na applicable sa employee sa ibinigay na petsa —
// ang pinakabago sa mga schedule na naka-effective na at hindi pa
// nag-e-expire. Null kung walang assigned schedule.
function getActiveSchedule(schedules, employeeId, dateStr) {
  const date = dateStr || new Date().toISOString().split('T')[0];
  const candidates = (schedules || []).filter(s =>
    s.employee_id === employeeId &&
    s.effective_date && s.effective_date <= date &&
    (!s.end_date || s.end_date >= date)
  );
  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0];
}

// Ilang minuto ang ibabawas sa work hours dahil sa breaks.
// Priyoridad: (1) aktwal na break punch (out+in) mula sa attendance record;
// (2) kung enabled ang break pero walang punch, ang naka-configure na
// window (end-start) ang default deduction. Kung wala talagang schedule
// o walang naka-enable na break dito, babalik sa lumang flat na
// fallbackMinutes (hal. shift.break_minutes) para hindi masira ang
// computation ng mga employee na hindi pa na-configure ang bagong feature.
function computeBreakMinutes(schedule, att, fallbackMinutes) {
  const anyEnabled = schedule && BREAK_TYPES.some(bt => schedule[`${bt.key}_enabled`] === 'true');
  if (!anyEnabled) return parseFloat(fallbackMinutes || 0);
  let total = 0;
  BREAK_TYPES.forEach(bt => {
    if (schedule[`${bt.key}_enabled`] !== 'true') return;
    const outT = att && att[`${bt.key}_out`];
    const inT  = att && att[`${bt.key}_in`];
    const outM = timeToMin(outT), inM = timeToMin(inT);
    if (outM !== null && inM !== null) {
      total += Math.max(0, inM - outM);
    } else {
      const sM = timeToMin(schedule[`${bt.key}_start`]), eM = timeToMin(schedule[`${bt.key}_end`]);
      if (sM !== null && eM !== null) total += Math.max(0, eM - sM);
    }
  });
  return total;
}

// Status ng isang partikular na break para sa attendance record ngayong
// araw: 'disabled' (hindi ginagamit ng schedule na ito), 'pending' (hindi
// pa sinimulan), 'ongoing' (naka-out, hinihintay bumalik), 'done'.
function breakStatus(schedule, att, breakKey) {
  if (!schedule || schedule[`${breakKey}_enabled`] !== 'true') return 'disabled';
  const outT = att && att[`${breakKey}_out`];
  const inT  = att && att[`${breakKey}_in`];
  if (outT && inT) return 'done';
  if (outT) return 'ongoing';
  return 'pending';
}

// Compact text summary ng mga break na na-punch sa isang attendance record,
// hal. "☕10:05–10:20  🍽️12:00–13:00". Ginagamit ng kiosk (Today's Record)
// at ng Attendance HR table para makita agad ang aktwal na break times.
function breakSummaryText(att) {
  if (!att) return '';
  return BREAK_TYPES.map(bt => {
    const o = att[`${bt.key}_out`], i = att[`${bt.key}_in`];
    if (!o) return null;
    return `${bt.icon}${o}${i ? ('–' + i) : '…'}`;
  }).filter(Boolean).join('  ');
}
