// api/read.js
// GET /api/read?id=123&token=JWT
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok:false, error:"method_not_allowed" });
  const { id } = req.query;
  const token = req.query.token || req.headers["x-mail-tm-token"];
  if (!id || !token) return res.status(400).json({ ok:false, error:"missing_params" });

  try {
    const r = await fetch(`https://api.mail.tm/messages/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) {
      const t = await r.text().catch(()=>"");
      return res.status(502).json({ ok:false, error:"provider_error", status:r.status, body:t || null });
    }
    const json = await r.json();
    return res.json({ ok:true, message: json });
  } catch (err) {
    console.error("[read] err", err);
    return res.status(500).json({ ok:false, error:"read_exception", detail:String(err) });
  }
}
