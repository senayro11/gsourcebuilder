// ============================================================
//  AI-PROXY.JS — Cloudflare Worker: Groq/Gemini proxy for the AI Assistant
// ============================================================
//
// Deployed at https://eis-ai-proxy.v-ryane59.workers.dev (Cloudflare
// dashboard -> Workers & Pages -> eis-ai-proxy). This file is kept here
// for reference/history only -- Cloudflare doesn't pull from this repo,
// so an actual change needs to be pasted into the Worker's own editor and
// deployed from there.
//
// Why this exists: js/config-ai.js used to hold the real Groq/Gemini API
// keys directly, which kept getting them auto-revoked by the providers'
// leaked-credential scanners since gsourcebuilder is a public repo. This
// Worker holds those keys instead, as encrypted secrets (GROQ_API_KEY /
// GEMINI_API_KEY under Settings -> Variables and Secrets) that are never
// shipped to the browser -- js/ai-assistant.js posts the question plus
// which provider/model to use here, and this makes the actual upstream
// call server-side.
//
// To rotate a key: update the secret value in the Worker's settings, not
// this file -- nothing here needs to change for that.

const ALLOWED_ORIGIN = 'https://senayro11.github.io';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function callGroq(apiKey, model, systemPrompt, userPrompt) {
  if (!apiKey) throw new Error('GROQ_API_KEY not configured on the server');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      temperature: 0.3,
      max_tokens: 800
    })
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const json = await res.json();
  return (json.choices?.[0]?.message?.content || '').trim();
}

async function callGemini(apiKey, model, systemPrompt, userPrompt) {
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured on the server');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
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

export default {
  async fetch(request, env, ctx) {
    const headers = corsHeaders();

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    const { provider, model, systemPrompt, userPrompt } = body || {};
    if (!provider || !model || !userPrompt) {
      return new Response(JSON.stringify({ error: 'Missing provider, model, or userPrompt' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    try {
      let text;
      if (provider === 'groq') {
        text = await callGroq(env.GROQ_API_KEY, model, systemPrompt, userPrompt);
      } else if (provider === 'gemini') {
        text = await callGemini(env.GEMINI_API_KEY, model, systemPrompt, userPrompt);
      } else {
        return new Response(JSON.stringify({ error: 'Unknown provider: ' + provider }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ text }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 502, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
  }
};
