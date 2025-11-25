// api/create.js
// Create an account on mail.tm and return token + address
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const domainResp = await fetch("https://api.mail.tm/domains");
    const domains = await domainResp.json();
    const domain = (domains?.hydra?.member && domains.hydra.member[0]?.domain) || "mail.tm";

    // generate local-part and password
    const local = Math.random().toString(36).slice(2, 14);
    const address = `${local}@${domain}`;
    const password = Math.random().toString(36).slice(2, 12);

    // create account
    const createResp = await fetch("https://api.mail.tm/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
    });

    // if account creation fails because address exists, retry few times
    if (!createResp.ok) {
      const text = await createResp.text();
      return res.status(400).json({ error: "Create account failed", detail: text });
    }

    // get token
    const tokenResp = await fetch("https://api.mail.tm/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
    });

    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      return res.status(400).json({ error: "Token request failed", detail: t });
    }

    const tokenData = await tokenResp.json();

    // return address + token (frontend will store token)
    return res.status(200).json({
      address,
      password,
      id: tokenData?.account || null,
      token: tokenData?.token || null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server error", detail: String(err) });
  }
}
