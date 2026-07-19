// ============================================================
//  DB.JS — TXT File Database Engine via GitHub API
// ============================================================

const DB = (() => {

  // Cache para hindi paulit-ulit mag-fetch
  const cache = {};
  const shas  = {};  // file SHAs needed for update

  function apiUrl(filename) {
    const { owner, repo, branch, dbPath } = GITHUB_CONFIG;
    return `https://api.github.com/repos/${owner}/${repo}/contents/${dbPath}/${filename}.txt`;
  }

  function headers() {
    return {
      'Authorization': `token ${GITHUB_CONFIG.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }

  // Ilang beses subukan bago mag-give up. Dalawang klase ng transient
  // failure ang hina-handle dito: (1) flaky mobile data (LTE/weak signal) —
  // fetch() mismo ang nag-tha-throw; (2) GitHub secondary rate limit (403)
  // o 429 — hindi ito totoong "invalid" na error, sandaling paghinto lang
  // bago tuloy ulit. Hindi ito naka-retry sa tunay na HTTP error responses
  // gaya ng 401/404/422.
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

  // Parse TXT (pipe-delimited) → array of objects
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

  // Serialize array of objects → TXT
  function serializeTxt(rows, headerRow) {
    if (!rows || rows.length === 0) return headerRow + '\n';
    const keys = headerRow.split('|');
    const lines = rows.map(row => keys.map(k => (row[k] ?? '')).join('|'));
    return [headerRow, ...lines].join('\n') + '\n';
  }

  // Read a DB file → array of row objects
  // Kapag walang internet/GitHub access, babalik sa huling naka-cache na
  // snapshot (localStorage) para tuloy-tuloy pa rin gumana ang app offline.
  async function read(dbName, forceRefresh = false) {
    if (cache[dbName] && !forceRefresh) return cache[dbName];
    try {
      const res = await fetchRetry(apiUrl(dbName), { headers: headers() });
      if (!res.ok) {
        if (res.status === 404) {
          cache[dbName] = []; cache[`${dbName}_header`] = '';
          if (typeof Sync !== 'undefined') Sync.cacheSet(dbName, [], '');
          return [];
        }
        throw new Error(`DB read error ${res.status}: ${dbName}`);
      }
      const json = await res.json();
      shas[dbName]  = json.sha;
      const content = atob(json.content.replace(/\n/g, ''));
      cache[dbName] = parseTxt(content);
      cache[`${dbName}_header`] = content.split('\n')[0];
      if (typeof Sync !== 'undefined') Sync.cacheSet(dbName, cache[dbName], cache[`${dbName}_header`]);
      return cache[dbName];
    } catch (e) {
      if (typeof Sync !== 'undefined' && Sync.isConnectivityError(e)) {
        const local = Sync.cacheGet(dbName);
        if (local) {
          cache[dbName] = local.rows;
          cache[`${dbName}_header`] = local.header;
          return cache[dbName];
        }
      }
      throw e;
    }
  }

  // Write rows back to GitHub.
  // Kung walang internet, ise-save muna nang lokal (optimistic) at ipapasok
  // sa offline sync queue — awtomatikong ise-sync ni Sync.flush() paguwi ng koneksyon.
  async function write(dbName, rows, description) {
    const headerRow = cache[`${dbName}_header`] || Object.keys(rows[0] || {}).join('|');
    try {
      const content = serializeTxt(rows, headerRow);
      const encoded = btoa(unescape(encodeURIComponent(content)));
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
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `DB write error ${res.status}`);
      }
      const json = await res.json();
      shas[dbName]  = json.content.sha;
      cache[dbName] = rows;
      if (typeof Sync !== 'undefined') Sync.cacheSet(dbName, rows, headerRow);
      return { ok: true, queued: false };
    } catch (e) {
      if (typeof Sync !== 'undefined' && Sync.isConnectivityError(e)) {
        // Offline — i-save lokal muna, i-queue para sa auto-sync mamaya
        cache[dbName] = rows;
        Sync.cacheSet(dbName, rows, headerRow);
        Sync.queueWrite(dbName, rows, headerRow, description || `Update sa ${dbName}`);
        return { ok: true, queued: true };
      }
      throw e;
    }
  }

  // Force-commit a queue entry straight to GitHub using a fresh sha.
  // Ginagamit ni Sync.flush() lang — hindi dapat gamitin sa normal flow.
  async function forceCommit(dbName, rows, headerRow) {
    await read(dbName, true); // refresh sha mula sa remote
    cache[`${dbName}_header`] = headerRow || cache[`${dbName}_header`];
    return write(dbName, rows, '(sync)');
  }

  // Insert a new row
  async function insert(dbName, newRow) {
    const rows = await read(dbName, true);
    rows.push(newRow);
    return write(dbName, rows, 'Bagong record');
  }

  // Update row(s) by condition
  async function update(dbName, condition, updates) {
    const rows = await read(dbName, true);
    let changed = 0;
    const newRows = rows.map(row => {
      if (condition(row)) { changed++; return { ...row, ...updates }; }
      return row;
    });
    if (changed === 0) return false;
    await write(dbName, newRows, 'Pag-update ng record');
    return changed;
  }

  // Delete row(s) by condition
  async function remove(dbName, condition) {
    const rows = await read(dbName, true);
    const newRows = rows.filter(row => !condition(row));
    const deleted = rows.length - newRows.length;
    if (deleted === 0) return 0;
    await write(dbName, newRows, 'Pagtanggal ng record');
    return deleted;
  }

  // Generate next ID for a DB  (P009, EMP004, etc.)
  function nextId(rows, field, prefix) {
    if (rows.length === 0) return `${prefix}001`;
    const nums = rows.map(r => parseInt(r[field].replace(prefix, '')) || 0);
    const next = Math.max(...nums) + 1;
    return `${prefix}${String(next).padStart(3, '0')}`;
  }

  // Search rows
  function search(rows, query, fields) {
    const q = query.toLowerCase();
    return rows.filter(row =>
      fields.some(f => (row[f] || '').toLowerCase().includes(q))
    );
  }

  // Clear local cache (force re-fetch)
  function clearCache(dbName) {
    if (dbName) { delete cache[dbName]; delete shas[dbName]; }
    else { Object.keys(cache).forEach(k => delete cache[k]); }
  }

  return { read, write, insert, update, remove, forceCommit, nextId, search, parseTxt, serializeTxt, clearCache };
})();
