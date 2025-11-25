// api/messages.js
// GET /api/messages?token=<token>
export default async function handler(req, res) {
  const token = req.query.token || (req.headers.authorization && req.headers.authorization.split(" ")[1]);

  if (!token) return res.status(400).json({ error: "token required (query ?token= or Authorization: Bearer <token>)" });

  try {
    const resp = await fetch("https://api.mail.tm/messages?page=1&perPage=50", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      const t = await resp.text();
      return res.status(resp.status).json({ error: "mail.tm error", detail: t });
    }

    const data = await resp.json();

    // normalize items to lightweight shape
    const items = (data?.hydra?.member || []).map((m) => ({
      id: m.id,
      from: (m.from && m.from.address) || m.from || "unknown",
      subject: m.subject || "(no subject)",
      intro: m.intro || "",
      createdAt: m.createdAt,
    }));

    return res.status(200).json(items);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server error", detail: String(err) });
  }
}
