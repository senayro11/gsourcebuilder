// ============================================================
//  HR-CORE.JS — Shared utilities for HR system
// ============================================================

// Safety net — if a try/catch is missing anywhere on the page (e.g. an
// init function with no error handling), this still surfaces it as a toast
// instead of silently leaving the section stuck on "Loading...".
// Guarded (errorHandlerBusy) so this can't cause its own infinite loop
// if Toast.show() itself happens to error.
let errorHandlerBusy = false;
function reportUncaught(prefix, message, stack) {
  if (errorHandlerBusy) return;
  errorHandlerBusy = true;
  try {
    // Grab the first named stack frame — this is usually where you can
    // see which function the repeated calls originate from when
    // "Maximum call stack size exceeded" happens.
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

// ---- GitHub token/auth banner ----
// A raw "DB read error 403" toast means nothing to a non-technical user and
// disappears in a few seconds before they can even read it. When the saved
// GitHub token itself is the problem (expired/revoked/no access, vs. a
// normal rate limit that clears on its own), show a banner that stays on
// screen until the token is fixed, with a direct link to go set a new one.
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
// Tells apart "token is actually bad" from "just hit the rate limit" --
// both surface as HTTP 403, but only the rate-limit reset time is
// checkable via the x-ratelimit-remaining header.
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

// ---- Loading ----
const Loading = {
  // Set by silent background refreshes (see autoRefreshTick in
  // attendance.html) so re-used page-load functions don't flash the
  // full-screen spinner for a poll the user never asked for.
  suppressed: false,
  show(msg = 'Loading...') {
    if (Loading.suppressed) return;
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
        <div class="modal-header"><span class="modal-title">⚠️ Confirmation</span></div>
        <div class="modal-body"><p style="color:var(--text)">${msg}</p></div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="${id}-no">Cancel</button>
          <button class="btn btn-danger" id="${id}-yes">Yes, continue</button>
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
    const m = { admin: 'badge-blue', user: 'badge-info', staff: 'badge-success', ojt: 'badge-warning', guest: 'badge-gray', superadmin: 'badge-purple' };
    return `<span class="badge ${m[r] || 'badge-gray'}">${(r || '').toUpperCase()}</span>`;
  },
  statusBadge(s) {
    const m = {
      approved: 'badge-success', present: 'badge-success', active: 'badge-success', released: 'badge-success',
      pending: 'badge-warning', late: 'badge-warning', new: 'badge-info',
      pending_manager: 'badge-warning', pending_hr: 'badge-warning',
      absent: 'badge-danger', rejected: 'badge-danger', inactive: 'badge-gray', suspended: 'badge-gray', draft: 'badge-gray'
    };
    const labels = { pending_manager: 'Pending Manager', pending_hr: 'Pending HR' };
    return `<span class="badge ${m[s] || 'badge-gray'}">${labels[s] || s || ''}</span>`;
  },
  employmentTypeBadge(t) {
    const m = {
      'Regular': 'badge-success', 'Probationary': 'badge-warning', 'Casual': 'badge-blue',
      'Contractual': 'badge-purple', 'Agency-Hired': 'badge-gray'
    };
    return `<span class="badge ${m[t] || 'badge-gray'}">${t || 'Regular'}</span>`;
  },
  avatarHtml(name, size = '32', photoUrl = '') {
    if (photoUrl) {
      return `<div style="width:${size}px;height:${size}px;border-radius:50%;flex-shrink:0;overflow:hidden"><img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover"></div>`;
    }
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
    total, pages, page, start, perPage,
    showing: `${Math.min(start + 1, total)}–${Math.min(start + perPage, total)} of ${total}`
  };
}

// Remembers each table's chosen "rows per page" (by pagination element id)
// across re-renders, until the page is reloaded.
const pagerPerPage = {};
function getPerPage(elId, def) { return pagerPerPage[elId] || def; }

function renderPager(elId, paged, onPage) {
  const el = document.getElementById(elId);
  if (!el) return;
  const perPageOpts = [10, 25, 50, 100];
  if (!perPageOpts.includes(paged.perPage)) perPageOpts.unshift(paged.perPage);
  let h = `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;flex-wrap:wrap;gap:8px">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <label style="font-size:12px;color:var(--text3)">Rows per page</label>
      <select class="pager-perpage" style="width:72px;padding:5px 8px;font-size:12px">
        ${perPageOpts.map(n => `<option value="${n}" ${n === paged.perPage ? 'selected' : ''}>${n}</option>`).join('')}
      </select>
      <span style="font-size:12px;color:var(--text3)">Showing ${paged.showing}</span>
    </div>`;
  if (paged.pages > 1) {
    h += `<div style="display:flex;gap:4px">`;
    if (paged.page > 1)
      h += `<button class="btn btn-ghost btn-sm pager-btn" data-page="${paged.page - 1}">‹</button>`;
    for (let i = Math.max(1, paged.page - 2); i <= Math.min(paged.pages, paged.page + 2); i++)
      h += `<button class="btn ${i === paged.page ? 'btn-primary' : 'btn-ghost'} btn-sm pager-btn" data-page="${i}">${i}</button>`;
    if (paged.page < paged.pages)
      h += `<button class="btn btn-ghost btn-sm pager-btn" data-page="${paged.page + 1}">›</button>`;
    h += `</div>`;
  }
  h += '</div>';
  el.innerHTML = h;
  // Real closures via addEventListener -- the previous onclick="(${onPage.toString()})(...)"
  // re-parsed the callback as a brand new function with no access to the
  // original closure (e.g. the "rows" array it was defined against), so
  // every page-number click threw a ReferenceError and silently did nothing.
  el.querySelectorAll('.pager-btn').forEach(btn => {
    btn.addEventListener('click', () => onPage(parseInt(btn.dataset.page, 10)));
  });
  const perPageSel = el.querySelector('.pager-perpage');
  if (perPageSel) {
    perPageSel.addEventListener('change', () => {
      pagerPerPage[elId] = parseInt(perPageSel.value, 10);
      onPage(1);
    });
  }
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

  // Retry a few times before giving up. Two classes of transient failure
  // are handled here: (1) flaky mobile data — fetch() itself throws;
  // (2) GitHub secondary rate limit (403) or 429 — not a real "invalid"
  // error, just a brief pause before continuing.
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

  // 'hr_' prefix on Sync cache/queue keys so they don't collide with the
  // root app's same-named dbName (e.g. root's db/employeesDB.txt
  // vs hr/db/employeesDB.txt — different content despite the same name).
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
        const authErr = githubAuthErrorInfo(res);
        if (authErr) showGithubAuthBanner(authErr.text);
        throw new Error(authErr ? authErr.text : `DB read error ${res.status}: ${name}`);
      }
      hideGithubAuthBanner();
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
    const content = serialize(rows, header);
    const encoded = btoa(unescape(encodeURIComponent(content)));
    async function attempt() {
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
        const authErr = githubAuthErrorInfo(res);
        if (authErr) showGithubAuthBanner(authErr.text);
        const e = await res.json().catch(() => ({}));
        const err = new Error(authErr ? authErr.text : (e.message || `DB write error ${res.status}`));
        err.status = res.status;
        throw err;
      }
      hideGithubAuthBanner();
      const json = await res.json();
      shas[name] = json.content.sha;
      cache[name] = rows;
      if (typeof Sync !== 'undefined') Sync.cacheSet(syncKey(name), rows, header);
      return { ok: true, queued: false };
    }
    try {
      // Someone else committed a newer version of this file between our
      // last read and this write (stale sha) -- e.g. a fast double-tap on
      // Save, or another tab/device/session writing at the same time.
      // Re-fetch the current sha and retry with the same payload
      // (last-write-wins, the same semantics this app already documents
      // for offline sync) instead of surfacing a raw GitHub API error to
      // the user. 3 attempts still weren't always enough under a real
      // burst of concurrent writers, so this allows more attempts with a
      // longer backoff before giving up.
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
            await read(name, true);
          }
        }
      }
      throw lastErr;
    } catch (e) {
      if (typeof Sync !== 'undefined' && Sync.isConnectivityError(e)) {
        cache[name] = rows;
        Sync.cacheSet(syncKey(name), rows, header);
        Sync.queueWrite(syncKey(name), rows, header, description || `Update to ${name}`);
        return { ok: true, queued: true };
      }
      throw e;
    }
  }

  // Used only by Sync.flush() to commit a queued change using a
  // fresh sha from GitHub.
  async function forceCommit(name, rows, header) {
    await read(name, true);
    cache[`${name}_header`] = header || cache[`${name}_header`];
    return write(name, rows, '(sync)');
  }

  async function insert(name, row) {
    const rows = await read(name, true);
    rows.push(row);
    return write(name, rows, 'New record');
  }

  async function update(name, cond, updates) {
    const rows = await read(name, true);
    let n = 0;
    const newRows = rows.map(r => {
      if (cond(r)) { n++; return { ...r, ...updates }; }
      return r;
    });
    if (!n) return 0;
    await write(name, newRows, 'Record update');
    return n;
  }

  async function remove(name, cond) {
    const rows = await read(name, true);
    const newRows = rows.filter(r => !cond(r));
    if (newRows.length === rows.length) return 0;
    await write(name, newRows, 'Record deletion');
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
//  BREAK SCHEDULE — per-employee configurable break windows
//  (AM/Lunch/PM), used by the kiosk (timein.html) and by the Attendance/
//  Schedule pages (attendance.html). Each break can be toggled on/off,
//  and its time/duration is editable per employee in schedulesDB.
// ============================================================
// defaultPaid: common practice — short AM/PM breaks are "paid"
// (not deducted from hours), while lunch break is "unpaid"
// (deducted). This is only a form pre-fill for NEW schedules; existing
// schedules with no "_paid" value yet remain unpaid/deducted
// (matches the prior behavior before the paid/unpaid option was added).
const BREAK_TYPES = [
  { key: 'am_break',    label: 'AM Break',    icon: '☕', defaultStart: '10:00', defaultEnd: '10:15', defaultPaid: true },
  { key: 'lunch_break', label: 'Lunch Break', icon: '🍽️', defaultStart: '12:00', defaultEnd: '13:00', defaultPaid: false },
  { key: 'pm_break',    label: 'PM Break',    icon: '☕', defaultStart: '15:00', defaultEnd: '15:15', defaultPaid: true }
];

function timeToMin(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (m || 0);
}

// Pick the schedule row applicable to the employee on the given date —
// the most recent among schedules already in effect and not yet
// expired. Null if there's no assigned schedule.
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

// When an employee has no schedule assigned, still judge late/absent
// against a best-guess shift instead of always marking them "present" --
// pick the active shift whose start_time is closest to their actual
// time in (e.g. a morning check-in lands on Day Shift, an evening one on
// Night Shift). Distance is circular across midnight so a 22:00 shift
// start reads as close to a 23:50 check-in, not far.
function guessShiftForTime(shifts, timeStr) {
  const active = (shifts || []).filter(s => s.status === 'active' && s.start_time);
  if (!active.length || !timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const mins = h * 60 + m;
  let best = null, bestDist = Infinity;
  active.forEach(s => {
    const [sh, sm] = s.start_time.split(':').map(Number);
    const diff = Math.abs(mins - (sh * 60 + sm));
    const dist = Math.min(diff, 1440 - diff);
    if (dist < bestDist) { bestDist = dist; best = s; }
  });
  return best;
}

// Is this break "paid" (not deducted from hours)? Blank/not yet
// configured = 'false' (unpaid/deducted), so the computation for
// schedules set up before the paid/unpaid option was added doesn't
// suddenly change.
function isBreakPaid(schedule, breakKey) {
  return !!(schedule && schedule[`${breakKey}_paid`] === 'true');
}

// Minutes to deduct from work hours for (unpaid) breaks.
// Priority: (1) actual break punch (out+in) from the attendance record;
// (2) if the break is enabled but has no punch, the configured window
// (end-start) is the default deduction. If a break is "paid", it's never
// deducted whether punched or configured — it still counts as work
// time. If there's no schedule at all, or no break enabled on it, this
// falls back to the old flat fallbackMinutes (e.g. shift.break_minutes)
// so the computation for employees who haven't configured the new
// feature yet isn't broken.
function computeBreakMinutes(schedule, att, fallbackMinutes) {
  const anyEnabled = schedule && BREAK_TYPES.some(bt => schedule[`${bt.key}_enabled`] === 'true');
  if (!anyEnabled) return parseFloat(fallbackMinutes || 0);
  let total = 0;
  BREAK_TYPES.forEach(bt => {
    if (schedule[`${bt.key}_enabled`] !== 'true') return;
    if (isBreakPaid(schedule, bt.key)) return;
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

// Status of a particular break for today's attendance record:
// 'disabled' (not used by this schedule), 'pending' (not yet
// started), 'ongoing' (out, waiting to return), 'done'.
function breakStatus(schedule, att, breakKey) {
  if (!schedule || schedule[`${breakKey}_enabled`] !== 'true') return 'disabled';
  const outT = att && att[`${breakKey}_out`];
  const inT  = att && att[`${breakKey}_in`];
  if (outT && inT) return 'done';
  if (outT) return 'ongoing';
  return 'pending';
}

// Compact text summary of breaks punched on an attendance record,
// e.g. "☕10:05–10:20  🍽️12:00–13:00". Used by the kiosk (Today's Record)
// and the Attendance HR table to show actual break times at a glance.
function breakSummaryText(att) {
  if (!att) return '';
  return BREAK_TYPES.map(bt => {
    const o = att[`${bt.key}_out`], i = att[`${bt.key}_in`];
    if (!o) return null;
    return `${bt.icon}${o}${i ? ('–' + i) : '…'}`;
  }).filter(Boolean).join('  ');
}
