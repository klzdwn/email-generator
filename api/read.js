export default async function handler(req, res) {
  const { login, domain, id } = req.query;

  const data = await fetch(
    `https://www.1secmail.com/api/v1/?action=readMessage&login=${login}&domain=${domain}&id=${id}`
  ).then(r => r.json());

  res.json({ ok: true, data });
}
