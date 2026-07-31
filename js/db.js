// ============================================================
//  DB.JS — TXT File Database Engine via GitHub API
// ============================================================

// ---- GitHub token/auth banner ----
// A raw "DB read error 403" toast means nothing to a non-technical user and
// disappears in a few seconds before they can even react. When the saved
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
  b.innerHTML = `<span>⚠️ ${message}</span><a href="index.html" style="color:#fff;text-decoration:underline;font-weight:700;white-space:nowrap">I-update ang GitHub Token →</a>`;
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

const DB = (() => {

  // Cache so we don't fetch repeatedly
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

  // Retry a few times before giving up. Two classes of transient failure
  // are handled here: (1) flaky mobile data (LTE/weak signal) — fetch()
  // itself throws; (2) GitHub secondary rate limit (403) or 429 — not a
  // real "invalid" error, just needs a short pause before continuing.
  // Real HTTP error responses like 401/404/422 are not retried.
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
  // When there's no internet/GitHub access, falls back to the last cached
  // snapshot (localStorage) so the app keeps working offline.
  async function read(dbName, forceRefresh = false) {
    if (cache[dbName] && !forceRefresh) return cache[dbName];
    try {
      // no-store: GitHub's API sends a short Cache-Control max-age, and
      // the browser's own HTTP cache can otherwise serve that stale
      // response even on a page reload (only a true hard-refresh reliably
      // bypasses it) -- so a reload right after a write elsewhere could
      // silently show old data for up to that window instead of the
      // freshest commit. This in-memory `cache` object above is the only
      // caching layer that should apply.
      const res = await fetchRetry(apiUrl(dbName), { headers: headers(), cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 404) {
          cache[dbName] = []; cache[`${dbName}_header`] = '';
          if (typeof Sync !== 'undefined') Sync.cacheSet(dbName, [], '');
          return [];
        }
        const authErr = githubAuthErrorInfo(res);
        if (authErr) showGithubAuthBanner(authErr.text);
        throw new Error(authErr ? authErr.text : `DB read error ${res.status}: ${dbName}`);
      }
      hideGithubAuthBanner();
      const json = await res.json();
      shas[dbName]  = json.sha;
      // atob() alone only reverses the base64 -- it leaves each UTF-8
      // byte as its own raw char code instead of reassembling multi-byte
      // characters (e.g. an em dash written as "—" comes back as
      // mojibake). escape()+decodeURIComponent() is the standard
      // reverse of write()'s encodeURIComponent()+unescape()+btoa().
      const content = decodeURIComponent(escape(atob(json.content.replace(/\n/g, ''))));
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
  // When offline, saves locally first (optimistic) and queues it for
  // offline sync — Sync.flush() auto-syncs it once connectivity returns.
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
      if (typeof Sync !== 'undefined') Sync.cacheSet(dbName, rows, headerRow);
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
            await read(dbName, true);
          }
        }
      }
      throw lastErr;
    } catch (e) {
      if (typeof Sync !== 'undefined' && Sync.isConnectivityError(e)) {
        // Offline — save locally first, queue it for auto-sync later
        cache[dbName] = rows;
        Sync.cacheSet(dbName, rows, headerRow);
        Sync.queueWrite(dbName, rows, headerRow, description || `Update to ${dbName}`);
        return { ok: true, queued: true };
      }
      throw e;
    }
  }

  // Force-commit a queue entry straight to GitHub using a fresh sha.
  // Used only by Sync.flush() — should not be used in normal flow.
  async function forceCommit(dbName, rows, headerRow) {
    await read(dbName, true); // refresh sha from remote
    cache[`${dbName}_header`] = headerRow || cache[`${dbName}_header`];
    return write(dbName, rows, '(sync)');
  }

  // Insert a new row
  async function insert(dbName, newRow) {
    const rows = await read(dbName, true);
    rows.push(newRow);
    return write(dbName, rows, 'New record');
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
    await write(dbName, newRows, 'Record update');
    return changed;
  }

  // Delete row(s) by condition
  async function remove(dbName, condition) {
    const rows = await read(dbName, true);
    const newRows = rows.filter(row => !condition(row));
    const deleted = rows.length - newRows.length;
    if (deleted === 0) return 0;
    await write(dbName, newRows, 'Record deletion');
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
