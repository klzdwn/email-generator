export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const API = "https://api.mail.tm";

  // BANYAK fallback domain untuk cegah error
  const FALLBACK = [
    "mail.tm",
    "1secmail.com",
    "disposablemail.com",
    "comfyhthings.com"
  ];

  function rand(n = 10) {
    const c = "abcdefghijklmnopqrstuvwxyz0123456789";
    return Array(n)
      .fill(0)
      .map(() => c[Math.floor(Math.random() * c.length)])
      .join("");
  }

  try {
    let domain = FALLBACK[Math.floor(Math.random() * FALLBACK.length)];

    // coba fetch domain asli mail.tm
    try {
      const d = await fetch(`${API}/domains`);
      if (d.ok) {
        const j = await d.json();
        if (j["hydra:member"]?.length)
          domain = j["hydra:member"][0].domain;
      }
    } catch (_) {}

    const address = `${rand(12)}@${domain}`;
    const password = rand(12);

    // retry create 5x jika gagal
    let token = null;
    let lastError = null;

    for (let i = 0; i < 5; i++) {
      // create account
      const cre = await fetch(`${API}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, password })
      });

      if (cre.ok || cre.status === 409) {
        // login
        const tok = await fetch(`${API}/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, password })
        });

        if (tok.ok) {
          const j = await tok.json();
          token = j.token;
          break;
        } else {
          lastError = `token_fail_${tok.status}`;
        }
      } else {
        lastError = `create_fail_${cre.status}`;
      }
    }

    if (!token)
      return res.status(500).json({ ok: false, error: lastError });

    return res.json({
      ok: true,
      address,
      password,
      token
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_exception",
      detail: String(err)
    });
  }
}
