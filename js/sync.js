// ============================================================
//  SYNC.JS — Offline Queue & Auto-Sync Engine
//  Nagpapahintulot sa system na gumana offline (local cache) at
//  awtomatikong i-sync pabalik sa GitHub paguwi ng internet.
// ============================================================

const Sync = (() => {
  const QUEUE_KEY   = 'ent_sync_queue';
  const CACHE_PREFIX = 'ent_cache_';
  const PING_URL    = 'https://api.github.com/rate_limit';

  let flushing   = false;
  let realOnline = navigator.onLine;
  let lastSync   = localStorage.getItem('ent_last_sync') || null;
  let lastError  = '';

  function emit() {
    document.dispatchEvent(new CustomEvent('ent:sync-status', { detail: status() }));
  }

  function status() {
    const q = getQueue();
    const dbNames = Object.keys(q);
    return {
      online:  realOnline,
      pendingDbs: dbNames.length,
      pending: dbNames.reduce((n, k) => n + (q[k].log ? q[k].log.length : 1), 0),
      lastSync,
      lastError
    };
  }

  // --- Local cache (survives page reloads / offline app opens) ---
  function cacheGet(dbName) {
    const raw = localStorage.getItem(CACHE_PREFIX + dbName);
    return raw ? JSON.parse(raw) : null;
  }
  function cacheSet(dbName, rows, header) {
    localStorage.setItem(CACHE_PREFIX + dbName, JSON.stringify({ rows, header, savedAt: new Date().toISOString() }));
  }

  // --- Pending write queue ---
  // Keyed by dbName (hindi list ng ops) dahil ang bawat "write" ay palaging
  // full-state snapshot ng buong file — ang pinakabagong queued na rows para
  // sa isang dbName ay kumpleto nang sarili, kaya sapat nang panatilihin ang
  // huling desired state kasabay ng human-readable log para sa UI.
  function getQueue() {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : {};
  }
  function setQueue(q) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
    emit();
  }
  function queueWrite(dbName, rows, header, description) {
    const q = getQueue();
    const entry = q[dbName] || { log: [], firstQueuedAt: new Date().toISOString() };
    entry.rows = rows;
    entry.header = header;
    entry.log.push({ description: description || 'Pagbabago', ts: new Date().toISOString() });
    q[dbName] = entry;
    setQueue(q);
  }
  function removeFromQueue(dbName) {
    const q = getQueue();
    delete q[dbName];
    setQueue(q);
  }
  function clearQueue() {
    setQueue({});
  }

  // Is this a "we're offline / can't reach GitHub" failure, vs a real API error
  // (bad credentials, conflict, validation) that should surface to the user?
  function isConnectivityError(e) {
    if (!realOnline) return true;
    if (e instanceof TypeError) return true; // fetch() network failure
    if (e && /Failed to fetch|NetworkError|network/i.test(e.message || '')) return true;
    return false;
  }

  // Real connectivity probe — navigator.onLine only reflects the network
  // interface, hindi kung reachable talaga ang GitHub.
  async function ping() {
    try {
      const res = await fetch(PING_URL, { cache: 'no-store', mode: 'cors' });
      realOnline = res.ok || res.status === 403; // 403 pa rin = may connection
    } catch (e) {
      realOnline = false;
    }
    emit();
    return realOnline;
  }

  // Ang dbName ay maaaring galing sa root app (walang prefix, gamit ang
  // window.DB) o sa HR module (naka-prefix na "hr_", gamit ang window.HRDB)
  // — magkaibang engine dahil magkaibang dbPath/file ang tinutukoy nila
  // kahit magkapareho ang ilang pangalan (hal. "employeesDB").
  function engineFor(dbName) {
    if (dbName.startsWith('hr_')) {
      return typeof HRDB !== 'undefined' ? { db: HRDB, realName: dbName.slice(3) } : null;
    }
    return typeof DB !== 'undefined' ? { db: DB, realName: dbName } : null;
  }

  // I-commit ang bawat pending dbName sa GitHub gamit ang tamang engine's
  // forceCommit (fresh sha muna, tapos write). Kung mag-conflict/mag-fail
  // ang isa, i-log at ituloy pa rin ang iba — itigil lang kung bumalik na offline.
  async function flush() {
    if (flushing) return { synced: 0, remaining: Object.keys(getQueue()).length };
    if (!(await ping())) return { synced: 0, remaining: Object.keys(getQueue()).length };

    flushing = true;
    let synced = 0;
    try {
      let dbNames = Object.keys(getQueue());
      for (const dbName of dbNames) {
        const entry = getQueue()[dbName];
        if (!entry) continue;
        const engine = engineFor(dbName);
        if (!engine) continue; // hindi available sa page na ito — subukan ulit sa ibang page/flush
        try {
          await engine.db.forceCommit(engine.realName, entry.rows, entry.header);
          removeFromQueue(dbName);
          synced++;
        } catch (e) {
          if (isConnectivityError(e)) break; // bumalik offline habang nag-sync
          // Real error (hal. validation/permission) — i-log pero panatilihin
          // sa queue para masubukan ulit sa susunod na flush.
          lastError = `${dbName}: ${e.message}`;
        }
      }
      if (synced > 0) {
        lastSync = new Date().toISOString();
        localStorage.setItem('ent_last_sync', lastSync);
      }
    } finally {
      flushing = false;
      emit();
    }
    return { synced, remaining: Object.keys(getQueue()).length };
  }

  function init() {
    window.addEventListener('online',  () => { ping().then(ok => { if (ok) flush(); }); });
    window.addEventListener('offline', () => { realOnline = false; emit(); });
    ping().then(ok => { if (ok) flush(); });
    setInterval(() => { ping().then(ok => { if (ok && Object.keys(getQueue()).length) flush(); }); }, 25000);
  }

  return {
    init, ping, flush, status, emit,
    cacheGet, cacheSet,
    getQueue, queueWrite, removeFromQueue, clearQueue,
    isConnectivityError
  };
})();

document.addEventListener('DOMContentLoaded', () => Sync.init());
