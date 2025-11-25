export default async function handler(req, res) {
  const { login, domain } = req.query;

  if (!login || !domain) {
    return res.status(400).json({ ok: false, error: "missing_params" });
  }

  const inbox = await fetch(
    `https://www.1secmail.com/api/v1/?action=getMessages&login=${login}&domain=${domain}`
  ).then(r => r.json());

  res.json({ ok: true, inbox });
}
