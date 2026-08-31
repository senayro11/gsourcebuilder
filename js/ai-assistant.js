// ============================================================
//  AI-ASSISTANT.JS — Floating AI chat widget for system data Q&A
// ============================================================
//
// Self-mounting: include this + config-ai.js on any logged-in page and a
// chat bubble appears automatically. Deliberately independent of each
// page's own DB/Auth/UI module (this codebase duplicates those per system
// -- hr-core.js in particular doesn't expose withPath/hasPermission) so
// this file talks to the GitHub Contents API directly with its own
// read-only fetcher instead of reusing/mutating whatever the current page
// happens to have loaded.

(function () {
  if (typeof AI_CONFIG === 'undefined' || !AI_CONFIG.enabled) return;
  if (typeof GITHUB_CONFIG === 'undefined') return;

  const _session = (() => {
    try { return JSON.parse(sessionStorage.getItem('ent_session') || 'null'); }
    catch (e) { return null; }
  })();
  if (!_session) return;

  // ---- read-only GitHub fetch (own cache, never touches GITHUB_CONFIG.dbPath) ----
  const _cache = {};
  function parseTxt(raw) {
    const lines = raw.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
    if (lines.length < 1) return [];
    const headers = lines[0].split('|').map(h => h.trim());
    return lines.slice(1).map(line => {
      const vals = line.split('|');
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
      return obj;
    });
  }
  async function ghRead(path, dbName) {
    const key = `${path}/${dbName}`;
    if (_cache[key]) return _cache[key];
    const { owner, repo, branch, token } = GITHUB_CONFIG;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}/${dbName}.txt?ref=${branch}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' },
      cache: 'no-store'
    });
    if (!res.ok) {
      if (res.status === 404) { _cache[key] = []; return []; }
      throw new Error(`Hindi ma-fetch ang ${dbName} (${res.status})`);
    }
    const json = await res.json();
    const content = decodeURIComponent(escape(atob(json.content.replace(/\n/g, ''))));
    const rows = parseTxt(content);
    _cache[key] = rows;
    return rows;
  }

  // ---- role-based data scope ----
  // A local copy of js/config.js's PERMISSIONS, not a read of the page's own
  // global -- hr/attendance.html's own config script doesn't define
  // PERMISSIONS/ROLE_LEVELS at all (unlike every other system), so relying
  // on whatever the current page happens to declare would crash there.
  const AI_PERMISSIONS = {
    pos:        { admin: ['view','create','edit','delete','reports','settings','adjust','manage_users','timein'], staff: ['view','create','timein'], ojt: ['view','timein'], guest: ['view'] },
    inventory:  { admin: ['view','create','edit','delete','reports','settings','adjust','manage_users'], staff: ['view','create','adjust'], ojt: ['view'], guest: ['view'] },
    attendance: { admin: ['view','create','edit','delete','reports','settings','payroll','manage_users','timein'], staff: ['view','timein','own_records'], ojt: ['view','timein','own_records'], guest: [] },
    budget:     { admin: ['view','create','edit','delete','reports','settings','approve','manage_users'], staff: ['view','create'], ojt: ['view'], guest: [] },
    pm:         { admin: ['view','create','edit','delete','reports','settings','manage_users'], staff: ['view','create','edit'], ojt: ['view'], guest: ['view'] },
    preventive: { admin: ['view','create','edit','delete','reports','settings','manage_users'], staff: ['view','create','edit'], ojt: ['view'], guest: ['view'] }
  };
  function canSeeSystem(user, sysKey) {
    if (user.role === 'superadmin') return true;
    if (user.assigned_system !== 'all' && user.assigned_system !== sysKey) return false;
    const perms = (AI_PERMISSIONS[sysKey] || {})[user.role] || [];
    return perms.includes('view');
  }
  function canSeeAllRecords(user, sysKey) {
    if (user.role === 'superadmin' || user.role === 'admin') return true;
    const perms = (AI_PERMISSIONS[sysKey] || {})[user.role] || [];
    return perms.includes('reports');
  }

  // Display names for the {system} placeholder in AI_CONFIG.roleRules --
  // own copy for the same reason AI_PERMISSIONS is (hr-config.js never
  // defines SYSTEMS at all).
  const AI_SYSTEM_NAMES = {
    pos: 'Point of Sale', inventory: 'Inventory', attendance: 'HR Management',
    budget: 'Budget & Finance', pm: 'Project Management', preventive: 'Preventive Maintenance'
  };

  // Which roleRules template applies, and what {system} resolves to.
  // Scope is driven by assigned_system, not the role name alone -- an admin
  // CAN be assigned 'all' just like a superadmin, and that should read as
  // full access too, not get squeezed into the single-department template.
  function roleInstruction(user) {
    if (!AI_CONFIG.roleRules) return '';
    const fullAccess = user.role === 'superadmin' || user.assigned_system === 'all';
    const tpl = fullAccess
      ? AI_CONFIG.roleRules.fullAccess
      : (AI_CONFIG.roleRules[user.role] || AI_CONFIG.roleRules.staff);
    if (!tpl) return '';
    const sysName = AI_SYSTEM_NAMES[user.assigned_system] || user.assigned_system || 'wala';
    return tpl.replace(/\{system\}/g, sysName);
  }

  // ---- which system(s) a question is about ----
  const SYSTEM_TOPICS = {
    attendance: ['absent','present','late','attendance','leave','payroll','employee','oras','pasok','sched','time in','time out'],
    preventive: ['preventive','maintenance','fire extinguisher','inspection','pm ','checkup','due','schedule'],
    pos:        ['sales','benta','order','transaction','resibo','cashier'],
    inventory:  ['stock','imbentaryo','inventory','supply','produkto','product'],
    budget:     ['budget','gastos','expense','pondo','finance','income'],
    pm:         ['project','proyekto','task','gawain','deadline','phase']
  };
  function detectSystems(question) {
    const q = question.toLowerCase();
    return Object.keys(SYSTEM_TOPICS).filter(sys => SYSTEM_TOPICS[sys].some(kw => q.includes(kw)));
  }

  // ---- per-system data summarizers (small, bounded text blocks) ----
  const SYSTEM_SUMMARIZERS = {
    attendance: async (user) => {
      const scopeAll = canSeeAllRecords(user, 'attendance');
      let rows = await ghRead('hr/db', 'attendanceDB');
      if (!scopeAll) rows = rows.filter(r => r.employee_id === user.employee_id);
      if (rows.length === 0) return '[ATTENDANCE] Walang attendance records na makikita.';
      const byDate = {};
      rows.forEach(r => {
        byDate[r.date] = byDate[r.date] || {};
        byDate[r.date][r.status] = (byDate[r.date][r.status] || 0) + 1;
      });
      const dates = Object.keys(byDate).filter(Boolean).sort().slice(-14);
      const lines = dates.map(d => `${d}: ` + Object.entries(byDate[d]).map(([s, c]) => `${s}=${c}`).join(', '));
      let out = `[ATTENDANCE${scopeAll ? '' : ' - sarili lang ni ' + user.full_name}]\n` + lines.join('\n');
      if (scopeAll) {
        const employees = await ghRead('hr/db', 'employeesDB');
        out += `\nTotal Active Employees: ${employees.filter(e => e.status === 'active').length}`;
      }
      return out;
    },
    preventive: async () => {
      const clients = await ghRead('preventive/db', 'clientsDB');
      const schedules = await ghRead('preventive/db', 'clientPreventivesDB');
      const clientName = id => clients.find(c => c.id === id)?.client_name || id;
      if (schedules.length === 0) return '[PREVENTIVE MAINTENANCE] Walang naka-record na schedules.';
      const lines = schedules.map(s => `${clientName(s.client_id)} — ${s.preventive_type} (${s.frequency}), floors: ${s.floors || '-'}, last: ${s.last_preventive_date || '-'}, next due: ${s.next_due_date || '-'}`);
      const batches = await ghRead('preventive/db', 'fireExtinguisherBatchesDB');
      const recentBatches = batches.slice(-5).map(b => `${clientName(b.client_id)}: ${b.date_from} to ${b.date_to} (generated ${b.created_at})`);
      return `[PREVENTIVE MAINTENANCE SCHEDULES]\n${lines.join('\n')}\n\n[RECENT FIRE EXTINGUISHER INSPECTION BATCHES]\n${recentBatches.join('\n') || 'wala pa'}`;
    },
    // Transaction-level data (who cashiered/recorded/is assigned what) has a
    // real personal owner, so it's fair to restrict it the same way as
    // attendance. Product stock levels and preventive schedules below don't
    // -- they're shared operational state everyone with department access
    // needs to see to do their job, not any one person's records -- so
    // those two stay department-wide regardless of 'reports'.
    pos: async (user) => {
      const scopeAll = canSeeAllRecords(user, 'pos');
      let rows = await ghRead('pos/db', 'transactionsDB');
      if (!scopeAll) rows = rows.filter(r => r.cashier === user.username);
      const today = new Date().toISOString().split('T')[0];
      const todayRows = rows.filter(r => (r.date || '').startsWith(today));
      const sum = rs => rs.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
      const label = scopeAll ? 'POS SALES' : `POS SALES - sarili lang ni ${user.full_name}`;
      return `[${label}]\nNgayong araw (${today}): ${todayRows.length} transactions, total ₱${sum(todayRows).toFixed(2)}\nLahat ng naka-log: ${rows.length} transactions, total ₱${sum(rows).toFixed(2)}`;
    },
    inventory: async () => {
      const products = await ghRead('db', 'productsDB');
      const lowStock = products.filter(p => parseFloat(p.stock) > 0 && parseFloat(p.stock) <= 10 && p.status !== 'inactive');
      const outStock = products.filter(p => parseFloat(p.stock) <= 0);
      return `[INVENTORY]\nTotal products: ${products.length}\nLow stock (<=10): ${lowStock.map(p => `${p.name} (${p.stock} ${p.unit})`).join(', ') || 'wala'}\nOut of stock: ${outStock.map(p => p.name).join(', ') || 'wala'}`;
    },
    budget: async (user) => {
      const scopeAll = canSeeAllRecords(user, 'budget');
      let rows = await ghRead('budget/db', 'budgetDB');
      if (!scopeAll) rows = rows.filter(r => r.recorded_by === user.username);
      const month = new Date().toISOString().slice(0, 7);
      const thisMonth = rows.filter(r => (r.date || '').startsWith(month));
      const sumType = t => thisMonth.filter(r => r.type === t).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
      const pending = rows.filter(r => r.status === 'pending').length;
      const label = scopeAll ? 'BUDGET' : `BUDGET - sarili lang ni ${user.full_name}`;
      return `[${label}]\nNgayong buwan (${month}): income ₱${sumType('income').toFixed(2)}, expense ₱${sumType('expense').toFixed(2)}\nPending approvals: ${pending}`;
    },
    pm: async (user) => {
      const scopeAll = canSeeAllRecords(user, 'pm');
      const projects = await ghRead('pm/db', 'projectsDB');
      let tasks = await ghRead('pm/db', 'projectTasksDB');
      if (!scopeAll) tasks = tasks.filter(t => t.assigned_to === user.full_name);
      const relevantIds = new Set(tasks.map(t => t.project_id));
      const visibleProjects = scopeAll ? projects : projects.filter(p => relevantIds.has(p.id) || p.created_by === user.username);
      const projName = id => projects.find(p => p.id === id)?.name || id;
      const openTasks = tasks.filter(t => t.status !== 'completed');
      const lines = visibleProjects.map(p => `${p.name} (${p.client || '-'}) — status: ${p.status}, progress: ${p.progress || 0}%`);
      const taskLines = openTasks.slice(0, 15).map(t => `- ${t.task_name} (${projName(t.project_id)}) — ${t.status}, due ${t.end_date || '-'}`);
      const label = scopeAll ? 'PROJECTS' : `PROJECTS - sariling task lang ni ${user.full_name}`;
      return `[${label}]\n${lines.join('\n') || 'wala pang project'}\n\nOpen/pending tasks: ${openTasks.length}\n${taskLines.join('\n')}`;
    }
  };

  async function buildContext(question) {
    const matched = detectSystems(question);
    const accessible = matched.filter(s => canSeeSystem(_session, s));
    const denied = matched.filter(s => !accessible.includes(s));
    const parts = [];
    for (const sys of accessible) {
      try { parts.push(await SYSTEM_SUMMARIZERS[sys](_session)); }
      catch (e) { parts.push(`[${sys}] Hindi ma-fetch ang data: ${e.message}`); }
    }
    let prompt = `TANONG: ${question}\n\nUSER: ${_session.full_name} (role: ${_session.role})\n\n`;
    if (denied.length) prompt += `ACCESS: Walang access ang user sa: ${denied.join(', ')}\n\n`;
    prompt += parts.length ? `SYSTEM DATA:\n${parts.join('\n\n')}` : 'SYSTEM DATA: (wala, walang tumugmang system sa tanong)';
    return prompt;
  }

  // ---- provider calls ----
  async function callGroq(p, systemPrompt, userPrompt) {
    const res = await fetch(p.endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${p.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: p.model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        temperature: 0.3,
        max_tokens: 800
      })
    });
    if (!res.ok) throw new Error(`Groq error ${res.status}`);
    const json = await res.json();
    return (json.choices?.[0]?.message?.content || '').trim();
  }
  async function callGemini(p, systemPrompt, userPrompt) {
    const url = `${p.endpoint}/${p.model}:generateContent?key=${encodeURIComponent(p.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
      })
    });
    if (!res.ok) throw new Error(`Gemini error ${res.status}`);
    const json = await res.json();
    return (json.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  }
  const CALLERS = { groq: callGroq, gemini: callGemini };
  const PROVIDER_LABELS = { gemini: 'Gemini', groq: 'Groq' };
  const PROVIDER_PREF_KEY = 'ai_asst_provider';

  // The user's dropdown choice, remembered per-browser -- falls back to
  // AI_CONFIG.defaultProvider (gemini) if nothing's been picked yet, or if
  // what was picked isn't a known provider (e.g. config-ai.js changed).
  function getSelectedProvider() {
    let stored = null;
    try { stored = localStorage.getItem(PROVIDER_PREF_KEY); } catch (e) {}
    if (stored && AI_CONFIG.providers[stored]) return stored;
    return AI_CONFIG.providers[AI_CONFIG.defaultProvider] ? AI_CONFIG.defaultProvider : Object.keys(AI_CONFIG.providers)[0];
  }
  function setSelectedProvider(key) {
    try { localStorage.setItem(PROVIDER_PREF_KEY, key); } catch (e) {}
  }

  async function askAI(systemPrompt, userPrompt) {
    const selected = getSelectedProvider();
    const order = [selected, ...Object.keys(AI_CONFIG.providers).filter(k => k !== selected)];
    const configured = order.filter(k => AI_CONFIG.providers[k]?.apiKey);
    if (configured.length === 0) {
      const e = new Error('Wala pang na-configure na AI API key. Sabihin sa superadmin na lagyan ng key ang js/config-ai.js.');
      e.noKey = true;
      throw e;
    }
    let lastErr;
    for (const key of configured) {
      try { return await CALLERS[key](AI_CONFIG.providers[key], systemPrompt, userPrompt); }
      catch (e) { lastErr = e; }
    }
    throw lastErr;
  }

  // ---- widget UI ----
  const STYLE = `
    .ai-asst-bubble {
      position: fixed; bottom: 20px; right: 20px; z-index: 400;
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--accent); color: #fff; border: none;
      font-size: 26px; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
    }
    .ai-asst-panel {
      position: fixed; bottom: 88px; right: 20px; z-index: 400;
      width: 360px; max-width: calc(100vw - 32px);
      height: 480px; max-height: calc(100vh - 120px);
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-lg); box-shadow: 0 12px 40px rgba(0,0,0,0.35);
      display: none; flex-direction: column; overflow: hidden;
    }
    .ai-asst-panel.open { display: flex; }
    .ai-asst-header {
      padding: 14px 16px; background: var(--surface2); border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
      font-weight: 700; color: var(--white); font-size: 14px; flex-shrink: 0;
    }
    .ai-asst-header-right { display: flex; align-items: center; gap: 10px; }
    .ai-asst-provider-select {
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      color: var(--text2); font-size: 12px; font-weight: 600; padding: 4px 6px; cursor: pointer;
    }
    .ai-asst-close { background: none; border: none; color: var(--text2); font-size: 18px; cursor: pointer; line-height: 1; }
    .ai-asst-messages { flex: 1 1 auto; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; min-height: 0; }
    .ai-asst-msg { max-width: 85%; padding: 9px 12px; border-radius: 12px; font-size: 13px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
    .ai-asst-msg.user { align-self: flex-end; background: var(--accent); color: #fff; border-bottom-right-radius: 3px; }
    .ai-asst-msg.bot  { align-self: flex-start; background: var(--surface2); color: var(--white); border-bottom-left-radius: 3px; }
    .ai-asst-msg.err  { align-self: flex-start; background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
    .ai-asst-empty { color: var(--text3); font-size: 13px; text-align: center; margin: auto; padding: 0 16px; }
    .ai-asst-inputrow { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--border); flex-shrink: 0; }
    .ai-asst-inputrow input {
      flex: 1 1 auto; min-width: 0; background: var(--surface2); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 9px 12px; color: var(--white); font-size: 13px;
    }
    .ai-asst-inputrow button {
      background: var(--accent); color: #fff; border: none; border-radius: var(--radius);
      padding: 0 16px; font-size: 13px; font-weight: 600; cursor: pointer; flex-shrink: 0;
    }
    .ai-asst-inputrow button:disabled { opacity: 0.5; cursor: default; }
    @media (max-width: 480px) {
      .ai-asst-panel { right: 16px; bottom: 84px; width: calc(100vw - 32px); }
      .ai-asst-bubble { right: 16px; bottom: 16px; }
    }
  `;

  function mount() {
    const styleEl = document.createElement('style');
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);

    const bubble = document.createElement('button');
    bubble.className = 'ai-asst-bubble';
    bubble.setAttribute('aria-label', 'AI Assistant');
    bubble.textContent = '🤖';

    const panel = document.createElement('div');
    panel.className = 'ai-asst-panel';
    panel.innerHTML = `
      <div class="ai-asst-header">
        <span>🤖 AI Assistant</span>
        <div class="ai-asst-header-right">
          <select class="ai-asst-provider-select" title="AI Provider"></select>
          <button class="ai-asst-close" aria-label="Close">✕</button>
        </div>
      </div>
      <div class="ai-asst-messages"><div class="ai-asst-empty">Magtanong tungkol sa system data — hal. "ilan ang absent ngayon?" o "kailan ang next preventive schedule?"</div></div>
      <div class="ai-asst-inputrow">
        <input type="text" placeholder="Mag-type ng tanong..." />
        <button type="button">Send</button>
      </div>
    `;

    document.body.appendChild(bubble);
    document.body.appendChild(panel);

    const messagesEl = panel.querySelector('.ai-asst-messages');
    const inputEl = panel.querySelector('input');
    const sendBtn = panel.querySelector('.ai-asst-inputrow button');
    const closeBtn = panel.querySelector('.ai-asst-close');
    const providerSelect = panel.querySelector('.ai-asst-provider-select');

    Object.keys(AI_CONFIG.providers).forEach(key => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = PROVIDER_LABELS[key] || key;
      providerSelect.appendChild(opt);
    });
    providerSelect.value = getSelectedProvider();
    providerSelect.addEventListener('change', () => setSelectedProvider(providerSelect.value));

    function addMsg(text, cls) {
      const empty = messagesEl.querySelector('.ai-asst-empty');
      if (empty) empty.remove();
      const div = document.createElement('div');
      div.className = `ai-asst-msg ${cls}`;
      div.textContent = text;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    bubble.addEventListener('click', () => {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) inputEl.focus();
    });
    closeBtn.addEventListener('click', () => panel.classList.remove('open'));

    async function send() {
      const question = inputEl.value.trim();
      if (!question) return;
      inputEl.value = '';
      inputEl.disabled = true;
      sendBtn.disabled = true;
      addMsg(question, 'user');
      const thinking = addMsg('Nag-iisip...', 'bot');
      try {
        const userPrompt = await buildContext(question);
        const scope = roleInstruction(_session);
        const systemPrompt = AI_CONFIG.rules + (scope ? `\n\nSCOPE PARA KAY ${_session.full_name} (${_session.role.toUpperCase()}): ${scope}` : '');
        const answer = await askAI(systemPrompt, userPrompt);
        thinking.textContent = answer || 'Walang naibalik na sagot.';
      } catch (e) {
        thinking.remove();
        addMsg(e.message || 'May naganap na error.', 'err');
      } finally {
        inputEl.disabled = false;
        sendBtn.disabled = false;
        inputEl.focus();
      }
    }
    sendBtn.addEventListener('click', send);
    inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
