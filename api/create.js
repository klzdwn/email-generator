// api/create.js
// Robust create: tries multiple times, handles domain fallback, returns detailed errors.
// Method: POST
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  function randLocal(len = 10) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  async function fetchJson(url, opts = {}) {
    const resp = await fetch(url, opts);
    const text = await resp.text().catch(() => "");
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
    return { ok: resp.ok, status: resp.status, body, raw: text };
  }

  try {
    // 1) get domains list (best-effort)
    const d = await fetchJson("https://api.mail.tm/domains");
    let domains = [];
    if (d.ok && d.body && d.body.hydra && Array.isArray(d.body.hydra.member)) {
      domains = d.body.hydra.member.map((m) => m.domain).filter(Boolean);
    } else {
      // fallback common domains
      domains = ["mail.tm", "trashmail.com", "disposablemail.com"];
    }

    // try up to N attempts to create unique mailbox
    const attempts = 6;
    let lastError = null;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const domain = domains[attempt % domains.length] || "mail.tm";
      const local = randLocal(12);
      const address = `${local}@${domain}`;
      const password = Math.random().toString(36).slice(2, 12);

      // try create account
      const createResp = await fetchJson("https://api.mail.tm/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, password }),
      });

      if (!createResp.ok) {
        // if 422 or 409 or other, record and retry
        lastError = { stage: "create", status: createResp.status, detail: createResp.body || createResp.raw };
        // if it's 422 (already exists) or 400, try again
        if (createResp.status === 422 || createResp.status === 400 || createResp.status === 409) {
          // continue to next attempt
          continue;
        } else {
          // for other status codes (rate-limit 429, 5xx), return immediately with detail
          return res.status(502).json({ error: "create_account_failed", status: createResp.status, detail: createResp.body || createResp.raw });
        }
      }

      // account created — now request token
      const tokenResp = await fetchJson("https://api.mail.tm/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, password }),
      });

      if (!tokenResp.ok) {
        // token failed — record & try again (rare)
        lastError = { stage: "token", status: tokenResp.status, detail: tokenResp.body || tokenResp.raw };
        // if token endpoint returned a useful message, stop
        if (tokenResp.status >= 400 && tokenResp.status < 500) {
          return res.status(502).json({ error: "token_request_failed", status: tokenResp.status, detail: tokenResp.body || tokenResp.raw });
        }
        continue;
      }

      const tokenData = tokenResp.body || {};
      return res.status(200).json({
        address,
        password,
        id: tokenData.account || null,
        token: tokenData.token || null,
      });
    }

    // all attempts failed
    return res.status(502).json({ error: "all_attempts_failed", lastError });
  } catch (err) {
    console.error("unexpected create error:", String(err));
    return res.status(500).json({ error: "unexpected_server_error", detail: String(err) });
  }
}
