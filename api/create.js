// api/create.js (debug version)
// Create a mailbox on mail.tm, return { address, password, id, token }
// Method: POST
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // 1) fetch domains
    let domainResp;
    try {
      domainResp = await fetch("https://api.mail.tm/domains");
    } catch (err) {
      console.error("fetch domains network error:", err);
      return res.status(502).json({ error: "network error when fetching domains", detail: String(err) });
    }

    if (!domainResp.ok) {
      const text = await domainResp.text().catch(() => "no-body");
      console.error("domains fetch failed:", domainResp.status, text);
      return res.status(502).json({ error: "failed to fetch domains", status: domainResp.status, detail: text });
    }

    const domainsData = await domainResp.json().catch((e) => {
      console.error("invalid json from domains:", e);
      return null;
    });
    const domain = (domainsData?.hydra?.member && domainsData.hydra.member[0]?.domain) || "mail.tm";

    // 2) generate credentials
    const local = Math.random().toString(36).slice(2, 14);
    const address = `${local}@${domain}`;
    const password = Math.random().toString(36).slice(2, 12);

    // 3) create account
    let createResp;
    try {
      createResp = await fetch("https://api.mail.tm/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, password }),
      });
    } catch (err) {
      console.error("create account network error:", err);
      return res.status(502).json({ error: "network error when creating account", detail: String(err) });
    }

    if (!createResp.ok) {
      const text = await createResp.text().catch(() => "no-body");
      console.error("create account failed:", createResp.status, text);
      return res.status(createResp.status).json({ error: "create account failed", status: createResp.status, detail: text });
    }

    // 4) request token
    let tokenResp;
    try {
      tokenResp = await fetch("https://api.mail.tm/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, password }),
      });
    } catch (err) {
      console.error("token request network error:", err);
      return res.status(502).json({ error: "network error when requesting token", detail: String(err) });
    }

    if (!tokenResp.ok) {
      const text = await tokenResp.text().catch(() => "no-body");
      console.error("token request failed:", tokenResp.status, text);
      return res.status(tokenResp.status).json({ error: "token request failed", status: tokenResp.status, detail: text });
    }

    const tokenData = await tokenResp.json().catch((e) => {
      console.error("invalid json from token:", e);
      return null;
    });

    return res.status(200).json({
      address,
      password,
      id: tokenData?.account || null,
      token: tokenData?.token || null,
    });
  } catch (err) {
    console.error("unexpected server error:", err);
    return res.status(500).json({ error: "unexpected server error", detail: String(err) });
  }
}
