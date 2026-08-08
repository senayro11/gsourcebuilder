// ============================================================
//  SYNC.JS — Offline Queue & Auto-Sync Engine
//  Lets the system work offline (local cache) and automatically
//  syncs back to GitHub once internet returns.
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
  // Keyed by dbName (not a list of ops) because every "write" is always a
  // full-state snapshot of the whole file — the most recently queued rows
  // for a given dbName are already complete on their own, so it's enough
  // to keep the latest desired state alongside a human-readable log for
  // the UI.
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
    entry.log.push({ description: description || 'Change', ts: new Date().toISOString() });
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
  // interface, not whether GitHub is actually reachable.
  async function ping() {
    try {
      const res = await fetch(PING_URL, { cache: 'no-store', mode: 'cors' });
      realOnline = res.ok || res.status === 403; // still 403 = there's a connection
    } catch (e) {
      realOnline = false;
    }
    emit();
    return realOnline;
  }

  // A queue/cache key comes from the HR module (prefixed "hr_", using
  // window.HRDB — different engine because it points at a different
  // dbPath/files even when some names coincide, e.g. "employeesDB"), or
  // from any page's own DB object (root, or one of the per-system
  // pos/inventory/budget copies). DB.js's syncKey() only leaves a key
  // bare when the table was accessed at the literal root 'db' path
  // (whether that's a root page's own default, or another page's
  // DB.withPath('db', ...) cross-read) -- so a bare key ALWAYS means
  // "root db", explicitly, regardless of whatever GITHUB_CONFIG.dbPath
  // the page that eventually flushes it happens to default to. A
  // "path|dbName" key means the table lives at that specific folder.
  // Either way, engineFor() always returns an explicit path so flush()
  // can wrap the commit correctly instead of trusting the flushing
  // page's own current default.
  function engineFor(key) {
    if (key.startsWith('hr_')) {
      return typeof HRDB !== 'undefined' ? { db: HRDB, realName: key.slice(3) } : null;
    }
    if (typeof DB === 'undefined') return null;
    const sep = key.indexOf('|');
    if (sep !== -1) return { db: DB, realName: key.slice(sep + 1), path: key.slice(0, sep) };
    return { db: DB, realName: key, path: 'db' };
  }

  // Commit each pending dbName to GitHub using the right engine's
  // forceCommit (fresh sha first, then write). If one conflicts/fails,
  // log it and keep going with the rest — only stop if we go back offline.
  async function flush() {
    if (flushing) return { synced: 0, remaining: Object.keys(getQueue()).length };
    if (!(await ping())) return { synced: 0, remaining: Object.keys(getQueue()).length };

    flushing = true;
    let synced = 0;
    try {
      let keys = Object.keys(getQueue());
      for (const key of keys) {
        const entry = getQueue()[key];
        if (!entry) continue;
        const engine = engineFor(key);
        if (!engine) continue; // not available on this page — try again on another page/flush
        try {
          const commit = () => engine.db.forceCommit(engine.realName, entry.rows, entry.header);
          await (engine.path ? engine.db.withPath(engine.path, commit) : commit());
          removeFromQueue(key);
          synced++;
        } catch (e) {
          if (isConnectivityError(e)) break; // went back offline mid-sync
          // Real error (e.g. validation/permission) — log it but keep it
          // in the queue to retry on the next flush.
          lastError = `${engine.realName}: ${e.message}`;
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
