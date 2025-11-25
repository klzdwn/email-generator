// api/message.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { token, id } = req.body;
  if (!token || !id) return res.status(400).json({ error: "Missing token or id" });

  try {
    const r = await fetch(`https://api.mail.tm/messages/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.text(); // mail.tm returns JSON but body may contain HTML; we'll parse on client
    // try parse json fallback:
    try {
      const j = JSON.parse(data);
      return res.status(r.ok ? 200 : 500).json(j);
    } catch {
      return res.status(r.ok ? 200 : 500).send(data);
    }
  } catch (e) {
    return res.status(500).json({ error: "server_error", detail: e.message });
  }
}
