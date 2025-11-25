// /api/message.js — Read individual messages
export default async function handler(req, res) {
  const { login, domain, id } = req.query;

  if (!login || !domain || !id) {
    return res.status(400).json({ error: "missing_params" });
  }

  const url = `https://www.1secmail.com/api/v1/?action=readMessage&login=${login}&domain=${domain}&id=${id}`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    res.status(200).json({ message: data });
  } catch (e) {
    res.status(500).json({ error: "read_failed", detail: String(e) });
  }
}
