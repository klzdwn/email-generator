// api/create.js
// Vercel Node 18 function, uses global fetch.
// Creates a mailbox via mail.tm (or similar). Adjust domain list if needed.

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method_not_allowed', detail: 'Use POST' });
      return;
    }

    // Optional: allow local dev to pass ?domain=somedomain
    const body = req.body || {};
    // prefer JSON body (Vercel will parse), or fallback to query
    const domainHint = body.domain || req.query?.domain || '';

    // Domains fallback - you can edit this list to ones accepted by the upstream API
    const fallbackDomains = ["mail.tm", "trashmail.com", "disposablemail.com", "1secmail.com", "comfythings.com"];

    // pick domain - if upstream supports domain selection
    const domain = domainHint || fallbackDomains[Math.floor(Math.random()*fallbackDomains.length)];

    // Generate local part + password
    const local = (Math.random().toString(36).slice(2, 10));
    const address = `${local}@${domain}`;
    const password = Math.random().toString(36).slice(2, 12);

    // Try create account at mail.tm API (example). Change URL if your upstream differs.
    const createUrl = 'https://api.mail.tm/accounts';
    const payload = { address, password };

    const createResp = await fetch(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Read body for better error reporting
    const createText = await createResp.text();
    let createJson = null;
    try { createJson = createText ? JSON.parse(createText) : null; } catch(e) { createJson = { raw: createText }; }

    if (!createResp.ok) {
      // return helpful error
      res.status(createResp.status).json({
        error: 'create_account_failed',
        detail: {
          stage: 'create',
          status: createResp.status,
          body: createJson,
          message: createJson?.message || createJson?.detail || null
        }
      });
      return;
    }

    // If mail.tm returns account object, also try to create a token (login) to use later
    // mail.tm expects POST to /token with JSON {address, password}
    let token = null;
    try {
      const tokenResp = await fetch('https://api.mail.tm/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password })
      });
      const tokenText = await tokenResp.text();
      const tokenJson = tokenText ? JSON.parse(tokenText) : null;
      if (tokenResp.ok && tokenJson?.token) token = tokenJson.token;
      else {
        // not fatal: return account created but token missing
        // include token error details
        token = null;
        // include token debug in response below
      }
    } catch (eToken) {
      // ignore but include in response body
      console.error('token error', eToken);
    }

    // respond success
    res.status(200).json({
      address,
      password,
      token,
      meta: { createdAt: new Date().toISOString() }
    });
  } catch (err) {
    console.error('create.js unhandled error', err);
    res.status(500).json({
      error: 'server_error',
      detail: {
        stage: 'create_unhandled',
        message: (err && err.message) ? err.message : String(err)
      }
    });
  }
}
