// api/messages.js
const fetch = globalThis.fetch || require('node-fetch');

module.exports = async (req, res) => {
  // expects Authorization header with Bearer <token>
  const auth = req.headers.authorization || req.headers.Authorization;
  if(!auth || !auth.startsWith('Bearer ')){
    res.status(401).json({ error:'missing_token' });
    return;
  }
  const token = auth.split(' ')[1];
  try{
    const r = await fetch('https://api.mail.tm/messages', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const text = await r.text();
    let body;
    try { body = text ? JSON.parse(text) : null; } catch(e){ body = text; }
    if(!r.ok){
      return res.status(r.status).json({ error:'mailtm_error', detail: body || text });
    }
    return res.status(200).json(body);
  }catch(err){
    console.error('[messages] err', err);
    return res.status(500).json({ error:'internal_error', message: err.message });
  }
};
