// api/messages.js
// GET /api/messages?token=JWT
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok:false, error:"method_not_allowed" });

  const token = req.query.token || req.headers["x-mail-tm-token"];
  if (!token) return res.status(400).json({ ok:false, error:"missing_token" });

  try {
    const r = await fetch("https://api.mail.tm/messages", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) {
      const t = await r.text().catch(()=>"");
      console.error("[messages] provider error", r.status, t);
      return res.status(502).json({ ok:false, error:"provider_error", status:r.status, body:t || null });
    }
    const json = await r.json();
    // return array of messages
    return res.json({ ok:true, inbox: json["hydra:member"] || json || [] });
  } catch (err) {
    console.error("[messages] err", err);
    return res.status(500).json({ ok:false, error:"messages_exception", detail:String(err) });
  }
}
