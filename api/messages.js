// /api/messages.js — Fetch inbox from 1SecMail
export default async function handler(req, res) {
  const { login, domain } = req.query;

  if (!login || !domain) {
    return res.status(400).json({ error: "missing_params" });
  }

  const url = `https://www.1secmail.com/api/v1/?action=getMessages&login=${login}&domain=${domain}`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    res.status(200).json({ messages: data });
  } catch (e) {
    res.status(500).json({ error: "fetch_failed", detail: String(e) });
  }
}
