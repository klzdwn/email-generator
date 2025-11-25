// api/message.js
// GET /api/message?id=<messageId>&token=<token>
// Returns full message detail (text/html) forwarded from mail.tm
export default async function handler(req, res) {
  const id = req.query.id;
  const token = req.query.token || (req.headers.authorization && req.headers.authorization.split(" ")[1]);

  if (!id) return res.status(400).json({ error: "id required" });
  if (!token) return res.status(400).json({ error: "token required (query ?token= or Authorization: Bearer <token>)" });

  try {
    const resp = await fetch(`https://api.mail.tm/messages/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(resp.status).json({ error: "mail.tm error", detail: txt });
    }

    const data = await resp.json();

    // return relevant fields; mail.tm returns text and html fields
    return res.status(200).json({
      id: data.id,
      from: data.from,
      to: data.to,
      subject: data.subject,
      intro: data.intro,
      text: data.text || "",
      html: data.html || "",
      createdAt: data.createdAt,
    });
  } catch (err) {
    console.error("message error", err);
    return res.status(500).json({ error: "server error", detail: String(err) });
  }
}
