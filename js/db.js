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
  async function read(dbName, forceRefresh = false) {
    if (cache[dbName] && !forceRefresh) return cache[dbName];
    const res = await fetch(apiUrl(dbName), { headers: headers() });
    if (!res.ok) {
      if (res.status === 404) { cache[dbName] = []; return []; }
      throw new Error(`DB read error ${res.status}: ${dbName}`);
    }
    const json = await res.json();
    shas[dbName]  = json.sha;
    const content = atob(json.content.replace(/\n/g, ''));
    cache[dbName] = parseTxt(content);
    cache[`${dbName}_header`] = content.split('\n')[0];
    return cache[dbName];
  }

  // Write rows back to GitHub
  async function write(dbName, rows) {
    const headerRow = cache[`${dbName}_header`] || Object.keys(rows[0]).join('|');
    const content   = serializeTxt(rows, headerRow);
    const encoded   = btoa(unescape(encodeURIComponent(content)));
    const body = {
      message: `Update ${dbName} - ${new Date().toISOString()}`,
      content: encoded,
      sha:     shas[dbName],
      branch:  GITHUB_CONFIG.branch
    };
    const res = await fetch(apiUrl(dbName), {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`DB write error: ${err.message}`);
    }
    const json = await res.json();
    shas[dbName]  = json.content.sha;
    cache[dbName] = rows;  // update cache
    return true;
  }

  // Insert a new row
  async function insert(dbName, newRow) {
    const rows = await read(dbName, true);
    rows.push(newRow);
    return write(dbName, rows);
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
    await write(dbName, newRows);
    return changed;
  }

  // Delete row(s) by condition
  async function remove(dbName, condition) {
    const rows = await read(dbName, true);
    const newRows = rows.filter(row => !condition(row));
    const deleted = rows.length - newRows.length;
    if (deleted === 0) return 0;
    await write(dbName, newRows);
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

  return { read, write, insert, update, remove, nextId, search, parseTxt, serializeTxt, clearCache };
})();
