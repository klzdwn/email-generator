export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const token = req.query.token;
  if (!token) return res.status(400).json({ ok: false, error: "missing_token" });

  try {
    const r = await fetch("https://api.mail.tm/messages", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) {
      return res.status(500).json({
        ok: false,
        error: "provider_error",
        status: r.status,
      });
    }

    const j = await r.json();
    return res.json({ ok: true, inbox: j["hydra:member"] || [] });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: "exception", detail: String(err) });
  }
}
