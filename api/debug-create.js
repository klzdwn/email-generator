// api/debug-create.js
// Debug endpoint (GET) — mencoba membuat mailbox sama seperti /api/create
// Returns full debug JSON so you can open this URL in browser and see why create fails.
//
// WARNING: This is temporary debug endpoint. Remove when done.

async function safeFetch(url, opts = {}) {
  try {
    const r = await fetch(url, opts);
    const text = await r.text().catch(() => "");
    let parsed;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    return { ok: r.ok, status: r.status, body: parsed, raw: text };
  } catch (err) {
    return { ok: false, fetchError: String(err) };
  }
}

function randLocal(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default async function handler(req, res) {
  // allow GET in browser for easy testing
  if (req.method !== "GET") return res.status(405).json({ error: "only GET allowed on this debug route" });

  try {
    // fetch domains (best-effort)
    const d = await safeFetch("https://api.mail.tm/domains");
    let domains = [];
    if (d.ok && d.body && d.body.hydra && Array.isArray(d.body.hydra.member)) {
      domains = d.body.hydra.member.map(m => m.domain).filter(Boolean);
    } else {
      domains = ["mail.tm"];
    }

    const attempts = 4;
    let lastError = null;

    for (let i = 0; i < attempts; i++) {
      const domain = domains[i % domains.length] || "mail.tm";
      const local = randLocal(12);
      const address = `${local}@${domain}`;
      const password = Math.random().toString(36).slice(2, 12);

      // try create account
      const createResp = await safeFetch("https://api.mail.tm/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, password }),
      });

      if (!createResp.ok) {
        lastError = { step: "create", attempt: i, status: createResp.status, body: createResp.body || createResp.raw, fetchError: createResp.fetchError || null };
        // if collision / bad request -> keep trying
        if ([400, 409, 422].includes(createResp.status)) continue;
        // for other status codes, return immediately with detail
        return res.status(502).json({ error: "create_failed_immediate", detail: lastError });
      }

      // try token
      const tokenResp = await safeFetch("https://api.mail.tm/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, password }),
      });

      if (!tokenResp.ok) {
        lastError = { step: "token", attempt: i, status: tokenResp.status, body: tokenResp.body || tokenResp.raw, fetchError: tokenResp.fetchError || null };
        // return detail
        return res.status(502).json({ error: "token_failed", detail: lastError });
      }

      // success
      return res.status(200).json({ address, password, token: tokenResp.body?.token || null, id: tokenResp.body?.account || null });
    }

    // exhausted attempts
    return res.status(502).json({ error: "all_attempts_failed", lastError });

  } catch (err) {
    return res.status(500).json({ error: "unexpected", detail: String(err) });
  }
}
