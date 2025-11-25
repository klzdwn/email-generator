// api/messages.js
// GET returns messages for mailbox token (via Authorization Bearer or ?token=)
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'method_not_allowed' });
      return;
    }

    // Get token from Authorization header or query param
    const auth = req.headers.authorization || '';
    let token = null;
    if (auth.toLowerCase().startsWith('bearer ')) token = auth.slice(7).trim();
    if (!token) token = req.query?.token || null;
    if (!token) {
      res.status(400).json({ error: 'missing_token', detail: 'Provide token in Authorization: Bearer <token> or ?token=' });
      return;
    }

    // try mail.tm messages endpoint
    const url = 'https://api.mail.tm/messages';
    const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + token }});
    const text = await resp.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch(e) { json = { raw: text }; }

    if (!resp.ok) {
      res.status(resp.status).json({ error: 'messages_fetch_failed', status: resp.status, body: json });
      return;
    }

    // mail.tm returns {hydra:...} usually; normalize to array
    // For mail.tm v1: {hydra: { member: [...]}} or {hydra: {member:[]}}
    let list = [];
    if (Array.isArray(json)) list = json;
    else if (json?.hydra?.member && Array.isArray(json.hydra.member)) list = json.hydra.member;
    else if (json?.messages && Array.isArray(json.messages)) list = json.messages;
    else if (json?.hydra) list = json.hydra;
    else list = json;

    res.status(200).json(list);
  } catch (err) {
    console.error('messages.js error', err);
    res.status(500).json({ error: 'server_error', detail: (err && err.message) ? err.message : String(err) });
  }
}
