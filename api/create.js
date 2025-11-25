// api/create.js
const fetch = globalThis.fetch || require('node-fetch');

function randString(len=6){
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s='';
  for(let i=0;i<len;i++) s+=chars[Math.floor(Math.random()*chars.length)];
  return s;
}

async function fetchJson(url, opts){
  const r = await fetch(url, opts);
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch(e){ json = text; }
  return { ok: r.ok, status: r.status, body: json, raw: text };
}

module.exports = async (req, res) => {
  if(req.method !== 'POST'){
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  try{
    // 1) get domains
    const domainsRes = await fetchJson('https://api.mail.tm/domains');
    let domain = null;
    if(domainsRes.ok && domainsRes.body && domainsRes.body['hydra:member'] && domainsRes.body['hydra:member'].length){
      domain = domainsRes.body['hydra:member'][0].domain;
    } else if(domainsRes.ok && Array.isArray(domainsRes.body) && domainsRes.body.length){
      domain = domainsRes.body[0].domain;
    } else {
      // fallback list
      const fallback = ['mail.tm','trashmail.com','disposableemail.com','1secmail.com'];
      domain = fallback[0];
      console.warn('domains fetch failed, using fallback', domainsRes.status, domainsRes.body);
    }

    // 2) create account
    const localpart = 'tm' + randString(8);
    const address = `${localpart}@${domain}`;
    const password = randString(12);

    const createRes = await fetchJson('https://api.mail.tm/accounts', {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({ address, password })
    });

    if(!createRes.ok){
      console.error('[create] create account response:', createRes.status, createRes.body);
      return res.status(500).json({ error: 'create_failed', detail:createRes.body || createRes.raw || null });
    }

    // 3) get token
    const tokenRes = await fetchJson('https://api.mail.tm/token', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ address, password })
    });

    if(!tokenRes.ok || !tokenRes.body || !tokenRes.body.token){
      console.error('[create] token response:', tokenRes.status, tokenRes.body);
      return res.status(500).json({ error: 'token_failed', detail: tokenRes.body || tokenRes.raw || null });
    }

    const token = tokenRes.body.token;
    return res.json({ address, password, token });

  }catch(err){
    console.error('[create] uncaught', err);
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
};
