// app.js - simple mail.tm client (static frontend)
// NOTE: mail.tm endpoints are public: https://api.mail.tm
// Stores token & account in localStorage.

const API_BASE = 'https://api.mail.tm';
const $ = sel => document.querySelector(sel);

const createBtn = $('#createBtn');
const deleteBtn = $('#deleteBtn');
const copyBtn = $('#copyBtn');
const fetchBtn = $('#fetchBtn');
const pollCheckbox = $('#pollCheckbox');

const addressEl = $('#address');
const passwordEl = $('#password');
const tokenEl = $('#token');
const messagesEl = $('#messages');
const debugEl = $('#debugLog');
const otpArea = $('#otpArea');
const otpValue = $('#otpValue');

let pollInterval = null;
let current = {
  address: localStorage.getItem('tm_address') || null,
  password: localStorage.getItem('tm_password') || null,
  token: localStorage.getItem('tm_token') || null,
  accountId: localStorage.getItem('tm_account_id') || null,
};

function logDebug(...args){
  const s = args.map(a => typeof a === 'string' ? a : JSON.stringify(a,null,2)).join(' ');
  debugEl.textContent = `${new Date().toLocaleTimeString()} - ${s}\n` + debugEl.textContent;
}

// ui refresh
function refreshUI(){
  addressEl.textContent = current.address || '-';
  passwordEl.textContent = current.password ? '••••••••' : '-';
  tokenEl.textContent = current.token ? (current.token.slice(0,22) + '…') : '-';
}

// helper fetch that returns {ok,status,body,raw}
async function fetchJson(url, opts = {}){
  try{
    const r = await fetch(url, opts);
    const text = await r.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch(e) { body = text; }
    return { ok: r.ok, status: r.status, body, raw: text };
  } catch(e){
    return { ok:false, status:0, body:null, fetchErr: String(e) };
  }
}

// get domains
async function getDomains(){
  const res = await fetchJson(API_BASE + '/domains');
  if(!res.ok) return [];
  // try to read array path
  if(res.body && Array.isArray(res.body['hydra:member'])) {
    return res.body['hydra:member'].map(d=>d.domain);
  }
  // fallback
  if(res.body && Array.isArray(res.body)) return res.body.map(d=>d.domain);
  return [];
}

// create account (tries random local part)
function randLocal(len=8){
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for(let i=0;i<len;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

async function createMailbox(){
  debugEl.textContent = '';
  logDebug('creating mailbox…');
  // domains
  const dres = await fetchJson(API_BASE + '/domains');
  logDebug('domains', dres);
  let domains = [];
  if(dres.ok && dres.body && Array.isArray(dres.body['hydra:member'])) {
    domains = dres.body['hydra:member'].map(m => m.domain).filter(Boolean);
  }
  if(!domains.length) domains = ['mail.tm','1secmail.com','trashmail.com']; // fallback

  const attempts = 6;
  for(let i=0;i<attempts;i++){
    const domain = domains[i % domains.length] || 'mail.tm';
    const local = randLocal(10);
    const address = `${local}@${domain}`;
    const password = Math.random().toString(36).slice(2,12);

    logDebug('try create', address);

    const createResp = await fetchJson(API_BASE + '/accounts', {
      method:'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ address, password })
    });

    logDebug('createResp', createResp);

    if(createResp.ok){
      // got account; now get token
      const tokenResp = await fetchJson(API_BASE + '/token', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ address, password })
      });

      logDebug('tokenResp', tokenResp);
      if(tokenResp.ok && tokenResp.body && tokenResp.body.token){
        current.address = address;
        current.password = password;
        current.token = tokenResp.body.token;
        current.accountId = createResp.body && createResp.body.id ? createResp.body.id : null;

        // save
        localStorage.setItem('tm_address', current.address);
        localStorage.setItem('tm_password', current.password);
        localStorage.setItem('tm_token', current.token);
        if(current.accountId) localStorage.setItem('tm_account_id', current.accountId);

        refreshUI();
        startPolling();
        return { ok:true };
      } else {
        // account created but token fail -> maybe immediate login not allowed
        return { ok:false, error:'token_failed', detail: tokenResp };
      }
    } else {
      // handle 422 (exists) -> try again; other -> return error
      if(createResp.status === 422 || createResp.status === 400) {
        logDebug('account exists or invalid, try next');
        continue;
      } else {
        return { ok:false, error:'create_account_failed', detail:createResp };
      }
    }
  }
  return { ok:false, error:'no_available' };
}

async function deleteMailbox(){
  // mail.tm does not always provide delete endpoint for account via token; but we can remove local data
  try{
    localStorage.removeItem('tm_address'); localStorage.removeItem('tm_password');
    localStorage.removeItem('tm_token'); localStorage.removeItem('tm_account_id');
    current = {address:null,password:null,token:null,accountId:null};
    refreshUI();
    stopPolling();
    logDebug('local mailbox cleared');
  }catch(e){
    logDebug('delete error', e);
  }
}

// fetch messages
async function fetchMessages(){
  if(!current.token) {
    logDebug('no token, cannot fetch messages');
    return;
  }
  messagesEl.innerHTML = '<p class="muted">Loading messages…</p>';
  const res = await fetchJson(API_BASE + '/messages', {
    headers: { Authorization: `Bearer ${current.token}` }
  });
  logDebug('messages list', res);
  if(!res.ok){
    messagesEl.innerHTML = `<p class="muted">Failed to fetch messages (status ${res.status})</p>`;
    return;
  }
  const list = Array.isArray(res.body['hydra:member']) ? res.body['hydra:member'] : (Array.isArray(res.body) ? res.body : []);
  if(!list.length){
    messagesEl.innerHTML = `<p class="muted">No messages yet.</p>`;
    otpArea.classList.add('hidden');
    return;
  }
  messagesEl.innerHTML = '';
  // show messages
  for(const m of list){
    const div = document.createElement('div');
    div.className = 'message';
    const from = m.from ? (m.from.address || m.from) : 'unknown';
    div.innerHTML = `<div><strong>${m.subject || '(no subject)'}</strong></div>
                     <div class="muted">From: ${from} — ${new Date(m.createdAt).toLocaleString()}</div>
                     <div id="body-${m.id}" class="msg-body muted">Loading body…</div>
                     <button data-id="${m.id}" class="viewBtn">View</button>`;
    messagesEl.appendChild(div);

    // prefetch body not always returned, so fetch each message body
    (async ()=>{
      const b = await fetchJson(API_BASE + `/messages/${m.id}`, { headers: { Authorization: `Bearer ${current.token}` } });
      logDebug('message body', b);
      const bodyEl = document.getElementById(`body-${m.id}`);
      if(b.ok && b.body){
        const text = b.body.html || b.body.text || JSON.stringify(b.body);
        bodyEl.innerHTML = text;
        detectOtp(text);
      } else {
        bodyEl.innerHTML = `<span class="muted">Failed to load message</span>`;
      }
    })();
  }
}

// detect OTP from a text/html blob
function detectOtp(text){
  if(!text) return;
  // strip tags and decode
  const tmp = document.createElement('div');
  tmp.innerHTML = text;
  const plain = tmp.textContent || tmp.innerText || text;
  // regex: 4-8 digit sequences (common OTP lengths)
  const m = plain.match(/\b(\d{4,8})\b/);
  if(m){
    otpArea.classList.remove('hidden');
    otpValue.textContent = m[1];
    logDebug('OTP detected', m[1]);
  }
}

// polling
function startPolling(){
  stopPolling();
  if(!pollCheckbox.checked) return;
  pollInterval = setInterval(fetchMessages, 4000);
  fetchMessages();
  logDebug('polling started');
}
function stopPolling(){
  if(pollInterval) { clearInterval(pollInterval); pollInterval = null; logDebug('polling stopped'); }
}

// attach events
createBtn.addEventListener('click', async ()=>{
  createBtn.disabled = true;
  const r = await createMailbox();
  logDebug('create result', r);
  if(!r.ok){
    alert('Gagal membuat mailbox: ' + (r.error || JSON.stringify(r.detail)));
    logDebug('create error', r);
  } else {
    refreshUI();
  }
  createBtn.disabled = false;
});

deleteBtn.addEventListener('click', async ()=>{
  if(!confirm('Delete local mailbox data?')) return;
  await deleteMailbox();
});

copyBtn.addEventListener('click', ()=>{
  if(!current.address) return alert('No address');
  navigator.clipboard.writeText(current.address).then(()=> alert('Copied'));
});

fetchBtn.addEventListener('click', ()=> fetchMessages());
pollCheckbox.addEventListener('change', ()=> {
  if(pollCheckbox.checked) startPolling(); else stopPolling();
});

// on load: restore token => start polling
(function init(){
  refreshUI();
  if(current.token){
    logDebug('found token, starting poll');
    startPolling();
  }
})();
// --- debug hide/show ---
const debugLog = document.querySelector('#debugLog');
const toggleDebugBtn = document.querySelector('#toggleDebugBtn');

toggleDebugBtn.addEventListener('click', () => {
  const hidden = debugLog.classList.toggle('hidden');
  toggleDebugBtn.textContent = hidden ? 'Show' : 'Hide';
});
