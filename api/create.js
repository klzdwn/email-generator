// api/create.js
// Debug-friendly create endpoint for mail.tm
// Returns detailed error object so frontend can show what's wrong.
//
// WARNING: This endpoint returns external API error bodies to the client
// temporarily for debugging. Remove verbose details for production.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // helper: safe fetch + body capture
  async function safeFetch(url, opts = {}) {
    try {
      const r = await fetch(url, opts);
      const text = await r.text().catch(() => "");
      // try to parse JSON, else return raw text
      let parsed;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = text;
      }
      return { ok: r.ok, status: r.status, headers: Object.fromEntries(r.headers), body: parsed, raw: text };
    } catch (err) {
      return { ok: false, fetchError: String(err) };
    }
  }

  // generator
  function randLocal(len = 10) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let out = "";
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  try {
    // 1) domains (best-effort)
    const d = await safeFetch("https://api.mail.tm/domains");
    let domains = [];
    if (d.ok && d.body && d.body.hydra && Array.isArray(d.body.hydra.member)) {
      domains = d.body.hydra.member.map((m) => m.domain).filter(Boolean);
    } else {
      // record domain fetch problem in debugResponse but continue with fallback
      // fallback list (common)
      domains = ["mail.tm"];
    }

    // We'll try multiple attempts to avoid collisions
    const maxAttempts = 6;
    let lastError = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const domain = domains[attempt % domains.length] || "mail.tm";
      const local = randLocal(12);
      const address = `${local}@${domain}`;
      const password = Math.random().toString(36).slice(2, 12);

      // 2) create account
      const createResp = await safeFetch("https://api.mail.tm/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, password }),
      });

      if (!createResp.ok) {
        // store lastError and decide whether to retry
        lastError = { stage: "create", attempt, status: createResp.status, body: createResp.body || createResp.raw, fetchErr: createResp.fetchError || null };
        // if 422 or 409 or 400 => collision or bad request -> try again
        if ([400, 409, 422].includes(createResp.status)) {
          continue;
        }
        // for rate-limit or server error, stop and return detail
        return res.status(502).json({ error: "create_account_failed", detail: lastError });
      }

      // 3) token request
      const tokenResp = await safeFetch("https://api.mail.tm/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, password }),
      });

      if (!tokenResp.ok) {
        lastError = { stage: "token", attempt, status: tokenResp.status, body: tokenResp.body || tokenResp.raw, fetchErr: tokenResp.fetchError || null };
        // if token failed with client error, return now
        if (tokenResp.status >= 400 && tokenResp.status < 500) {
          return res.status(502).json({ error: "token_request_failed", detail: lastError });
        }
        // else try next attempt
        continue;
      }

      // success — return credentials and token
      const tokenData = tokenResp.body || {};
      return res.status(200).json({
        address,
        password,
        id: tokenData.account || null,
        token: tokenData.token || null,
      });
    }

    // all attempts exhausted
    return res.status(502).json({ error: "all_attempts_failed", lastError });
  } catch (err) {
    // unexpected server error
    const msg = String(err);
    console.error("unexpected create error:", msg);
    return res.status(500).json({ error: "unexpected_server_error", detail: msg });
  }
}
