// api/create.js
// Simple, robust create mailbox function for mail.tm used on Vercel
// Usage: POST /api/create
// Returns JSON: { ok: true, address, password, token } or { ok: false, error, detail }

const MAILTM_BASE = 'https://api.mail.tm';

function randLocal(len = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

async function fetchJson(url, opts = {}) {
  try {
    const resp = await fetch(url, opts);
    const text = await resp.text().catch(() => '');
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
    return { ok: resp.ok, status: resp.status, body, raw: text };
  } catch (err) {
    return { ok: false, status: 0, body: null, error: String(err) };
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  console.log('[create] start create mailbox');

  // 1) fetch domains (best-effort)
  const d = await fetchJson(`${MAILTM_BASE}/domains`);
  console.log('[create] domains fetch result:', d.status, d.body ? (Array.isArray(d.body?.hydra?.member) ? `${d.body.hydra.member.length} members` : typeof d.body) : 'no-body');

  let domains = [];
  try {
    if (d.ok && d.body && Array.isArray(d.body.hydra?.member)) {
      domains = d.body.hydra.member.map(m => m.domain).filter(Boolean);
    }
  } catch (e) {
    console.log('[create] error parsing domains:', e);
  }

  // fallback domains if none found
  if (!domains || domains.length === 0) {
    domains = ['mail.tm', 'trashmail.com', 'disposablemail.com', '1secmail.com'];
    console.log('[create] using fallback domains', domains);
  }

  const attempts = 6;
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const domain = domains[attempt % domains.length] || domains[0];
      const local = randLocal(12);
      const address = `${local}@${domain}`;
      // generate a safe password: ensure it's a string and length
      const password = (Math.random().toString(36) + Math.random().toString(36)).slice(2, 14) || `p${Date.now()}`;

      console.log(`[create] attempt ${attempt} -> ${address}`);

      // create account
      const createResp = await fetchJson(`${MAILTM_BASE}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password })
      });

      console.log('[create] create account response:', createResp.status, createResp.body ? (typeof createResp.body === 'object' ? JSON.stringify(createResp.body).slice(0,200) : String(createResp.body)) : 'no-body');

      if (!createResp.ok) {
        lastError = { stage: 'create', status: createResp.status, body: createResp.body, fetchErr: createResp.error || null };
        // if 422 (already exists) or 400, try again with different local
        if (createResp.status === 422 || createResp.status === 400) {
          console.log('[create] account exists or bad request, continuing to next attempt');
          continue;
        }
        // other errors -> don't loop more; break and return error
        console.log('[create] create failed with non-retry status', createResp.status);
        break;
      }

      // create token
      const tokenResp = await fetchJson(`${MAILTM_BASE}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password })
      });

      console.log('[create] token response:', tokenResp.status, tokenResp.body ? (typeof tokenResp.body === 'object' ? JSON.stringify(tokenResp.body).slice(0,200) : String(tokenResp.body)) : 'no-body');

      if (!tokenResp.ok) {
        lastError = { stage: 'token', status: tokenResp.status, body: tokenResp.body, fetchErr: tokenResp.error || null };
        // try again (maybe transient)
        continue;
      }

      const token = tokenResp.body?.token || tokenResp.body?.access_token || null;

      if (!token) {
        lastError = { stage: 'token_missing', status: tokenResp.status, body: tokenResp.body, fetchErr: null };
        console.log('[create] token missing in response body');
        continue;
      }

      // success
      console.log('[create] success', address);
      return res.json({ ok: true, address, password, token });
    } catch (err) {
      console.error('[create] unexpected error:', String(err));
      lastError = { stage: 'exception', err: String(err) };
      // continue and retry a few times
    }
  }

  console.log('[create] all attempts failed, lastError:', lastError);
  return res.status(500).json({ ok: false, error: 'create_account_failed', detail: lastError });
};
