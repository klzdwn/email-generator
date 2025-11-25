// api/create.js
// Simple wrapper that logs everything for debugging and returns structured errors.
// Paste this replacing your existing api/create.js (keep backups).

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Helper to fetch and capture details
  async function fetchJson(url, opts = {}) {
    try {
      const resp = await fetch(url, opts);
      const text = await resp.text().catch(() => '');
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
      return { ok: resp.ok, status: resp.status, body, raw: text };
    } catch (err) {
      // network error
      return { ok: false, status: 0, body: null, raw: null, fetchErr: String(err) };
    }
  }

  try {
    // For debugging: log incoming request briefly
    console.log('[create] incoming request body:', JSON.stringify(req.body).slice(0, 2000));

    // Example: get domains from mail.tm API
    const d = await fetchJson('https://api.mail.tm/domains');
    console.log('[create] domains fetch result:', d);

    let domains = [];
    if (d && d.ok && d.body && d.body.hydra && Array.isArray(d.body.hydra.member)) {
      domains = d.body.hydra.member.map(m => m.domain).filter(Boolean);
    } else {
      // fallback domains
      domains = ["mail.tm","trashmail.com","disposablemail.com"];
    }
    console.log('[create] using domains:', domains);

    // Try to create mailbox (6 attempts)
    const attempts = 6;
    let lastErr = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const domain = domains[attempt % domains.length] || 'mail.tm';
      const local = Math.random().toString(36).slice(2, 14);
      const address = `${local}@${domain}`;
      const password = Math.random().toString(36).slice(2, 12);

      console.log(`[create] attempt ${attempt}: address=${address}`);

      const createResp = await fetchJson('https://api.mail.tm/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password })
      });

      console.log('[create] createResp:', createResp);

      if (createResp.ok) {
        // success -> create token
        const tokenResp = await fetchJson('https://api.mail.tm/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, password })
        });
        console.log('[create] tokenResp:', tokenResp);

        return res.status(200).json({
          ok: true,
          address,
          password,
          token: tokenResp && tokenResp.body && tokenResp.body.token ? tokenResp.body.token : null,
          details: { createResp, tokenResp }
        });
      } else {
        lastErr = createResp;
        // if 422 (exists) we try again
        if (createResp.status === 422 || createResp.status === 400) {
          console.warn('[create] account exists or bad request, continue attempts');
          continue;
        }
        // other errors - record and break
        console.error('[create] non-retry create error:', createResp);
        break;
      }
    }

    // All attempts failed
    console.error('[create] all attempts failed, lastErr:', lastErr);
    return res.status(500).json({ error: 'create_account_failed', detail: lastErr });

  } catch (err) {
    // Log full error stack
    console.error('[create] UNCAUGHT ERROR', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'internal_error', message: String(err) });
  }
}
