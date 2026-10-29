// ============================================================
//  EIS LOGIN PROXY — Cloudflare Worker
//  Holds the real GitHub token as a secret. The browser never sees
//  it until the username/password are verified here, server-side.
//  Rate-limits failed login attempts per IP using a KV namespace
//  bound as RATE_LIMIT_KV (no custom domain/WAF needed) — the
//  counter clears immediately on a successful login.
// ============================================================

const ALLOWED_ORIGIN = 'https://senayro11.github.io';
const OWNER    = 'senayro11';
const REPO     = 'gsourcebuilder';
const BRANCH   = 'main';
const DB_PATH  = 'db';

const RATE_LIMIT_MAX     = 5;   // max failed attempts
const RATE_LIMIT_WINDOW  = 900; // seconds (15 min) since the last failed attempt

function rateLimitKey(ip) { return `attempts:${ip}`; }

async function getFailedAttempts(env, ip) {
  const raw = await env.RATE_LIMIT_KV.get(rateLimitKey(ip));
  return raw ? parseInt(raw, 10) : 0;
}

async function recordFailedAttempt(env, ip, current) {
  await env.RATE_LIMIT_KV.put(rateLimitKey(ip), String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW });
}

async function clearFailedAttempts(env, ip) {
  await env.RATE_LIMIT_KV.delete(rateLimitKey(ip));
}

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

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const attempts = await getFailedAttempts(env, ip);
    if (attempts >= RATE_LIMIT_MAX) {
      return json({ error: 'Too many login attempts. Please wait a few minutes and try again.' }, 429);
    }

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

      if (!user) {
        await recordFailedAttempt(env, ip, attempts);
        return json({ success: false, message: 'Wrong username or password.' });
      }

      await clearFailedAttempts(env, ip);

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
