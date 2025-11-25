export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const { id, token } = req.query;
  if (!id || !token)
    return res.status(400).json({ ok: false, error: "missing_params" });

  try {
    const r = await fetch(`https://api.mail.tm/messages/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok)
      return res.status(500).json({
        ok: false,
        error: "provider_error",
        status: r.status,
      });

    const j = await r.json();
    return res.json({ ok: true, message: j });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: "exception", detail: String(err) });
  }
}
