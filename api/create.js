// api/create.js
// Create a mailbox on mail.tm and return { ok, address, password, token, id }
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error: "method_not_allowed" });

  const MAIL_API = "https://api.mail.tm";

  function randLocal(len = 10) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  try {
    // 1) get domains
    const domResp = await fetch(`${MAIL_API}/domains`);
    let domain = null;
    if (domResp.ok) {
      const domJson = await domResp.json().catch(()=>null);
      if (domJson && domJson["hydra:member"] && Array.isArray(domJson["hydra:member"]) && domJson["hydra:member"].length) {
        domain = domJson["hydra:member"][0].domain;
      }
    }
    // fallback common domains if API fails
    if (!domain) domain = "mail.tm";

    // 2) create unique address + password
    const local = randLocal(12);
    const address = `${local}@${domain}`;
    const password = Math.random().toString(36).slice(2, 12);

    // 3) create account
    const createResp = await fetch(`${MAIL_API}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password })
    });

    // if account creation failed but maybe already exists, try login
    if (!createResp.ok && createResp.status !== 201 && createResp.status !== 409) {
      // status 409 = already exists, other = error
      const text = await createResp.text().catch(()=>"");
      console.error("[create] create account failed", createResp.status, text);
      return res.status(502).json({ ok:false, error:"create_account_failed", status:createResp.status, body:text || null });
    }

    // 4) get token (login)
    const tokenResp = await fetch(`${MAIL_API}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password })
    });

    if (!tokenResp.ok) {
      const t = await tokenResp.text().catch(()=>"");
      console.error("[create] token failed", tokenResp.status, t);
      return res.status(502).json({ ok:false, error:"token_failed", status: tokenResp.status, body:t || null });
    }
    const tokenJson = await tokenResp.json();
    const token = tokenJson.token;

    // 5) return mailbox info + token
    return res.json({ ok:true, address, password, token });
  } catch (err) {
    console.error("[create] err", err);
    return res.status(500).json({ ok:false, error:"create_exception", detail: String(err) });
  }
}
