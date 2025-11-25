// api/delete.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { token, id } = req.body;
  if (!token || !id) return res.status(400).json({ error: "Missing token or id" });

  try {
    const r = await fetch(`https://api.mail.tm/accounts/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.status === 204) return res.status(200).json({ ok: true });
    const body = await r.json().catch(() => null);
    return res.status(r.ok ? 200 : r.status).json({ ok: false, body });
  } catch (e) {
    return res.status(500).json({ error: "server_error", detail: e.message });
  }
}
