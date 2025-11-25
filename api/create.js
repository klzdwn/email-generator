export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const API = "https://api.mail.tm";

  function rand(n = 10) {
    const c = "abcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    while (s.length < n) s += c[Math.floor(Math.random() * c.length)];
    return s;
  }

  try {
    // get domains
    let domain = "mail.tm";
    try {
      const d = await fetch(`${API}/domains`);
      if (d.ok) {
        const jd = await d.json();
        if (jd["hydra:member"]?.length)
          domain = jd["hydra:member"][0].domain;
      }
    } catch (_) {}

    const local = rand(12);
    const address = `${local}@${domain}`;
    const password = rand(12);

    // create account
    const cre = await fetch(`${API}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
    });

    if (!cre.ok && cre.status !== 409) {
      return res.status(500).json({
        ok: false,
        error: "create_failed",
        status: cre.status,
      });
    }

    // login (get token)
    const tok = await fetch(`${API}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
    });

    if (!tok.ok)
      return res
        .status(500)
        .json({ ok: false, error: "token_failed", status: tok.status });

    const j = await tok.json();

    return res.json({
      ok: true,
      address,
      password,
      token: j.token,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_exception",
      detail: String(err),
    });
  }
}
