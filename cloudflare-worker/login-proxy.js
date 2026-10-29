// ============================================================
//  EIS LOGIN PROXY — Cloudflare Worker
//  Holds the real GitHub token as a secret. The browser never sees
//  it until the username/password are verified here, server-side.
//  Set up a Cloudflare Rate Limiting Rule on this Worker's route
//  (e.g. 5 requests / 15 min per IP) to block password guessing.
// ============================================================

const ALLOWED_ORIGIN = 'https://senayro11.github.io';
const OWNER    = 'senayro11';
const REPO     = 'gsourcebuilder';
const BRANCH   = 'main';
const DB_PATH  = 'db';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function parseRows(text) {
  const lines = text.trim().split('\n');
  const headerCols = lines[0].split('|');
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const cols = line.split('|');
    const row = {};
    headerCols.forEach((h, i) => { row[h.trim()] = (cols[i] || '').trim(); });
    return row;
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

    const username = (body.username || '').trim();
    const password = body.password || '';
    if (!username || !password) return json({ error: 'Missing username or password' }, 400);

    try {
      const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${DB_PATH}/accountsDB.txt?ref=${BRANCH}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `token ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3.raw',
          'User-Agent': 'eis-login-proxy'
        }
      });
      if (!res.ok) return json({ error: `Could not reach accounts database (HTTP ${res.status})` }, 502);

      const text   = await res.text();
      const rows   = parseRows(text);
      const hashed = await sha256Hex(password);

      const user = rows.find(r =>
        r.username === username &&
        r.password_hash === hashed &&
        r.status === 'active'
      );

      if (!user) return json({ success: false, message: 'Wrong username or password.' });

      return json({
        success: true,
        token: env.GITHUB_TOKEN,
        user: {
          username:        user.username,
          full_name:       user.full_name,
          role:            user.role,
          assigned_system: user.assigned_system,
          email:           user.email,
          employee_id:     user.employee_id || ''
        }
      });
    } catch (e) {
      return json({ error: 'Server error: ' + e.message }, 500);
    }
  }
};
