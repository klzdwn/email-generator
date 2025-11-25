/* app.js
   Static temp-mail client using 1secmail API
   Auto polling every 3s, extract OTP codes (4-8 digits)
*/

const genBtn = document.getElementById('genBtn');
const newBtn = document.getElementById('newBtn');
const copyBtn = document.getElementById('copyBtn');
const addressBox = document.getElementById('addressBox');
const addressText = document.getElementById('addressText');
const inboxList = document.getElementById('inboxList');
const statusEl = document.getElementById('status');

const viewer = document.getElementById('viewer');
const mFrom = document.getElementById('mFrom');
const mSub = document.getElementById('mSub');
const mOtp = document.getElementById('mOtp');
const mBody = document.getElementById('mBody');
const closeMsg = document.getElementById('closeMsg');
const downloadMsg = document.getElementById('downloadMsg');

let login = null, domain = null;
let pollTimer = null;
let lastIds = new Set();

// util: random
function randStr(len = 10){
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i=0;i<len;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

// save/load to localStorage
function saveState(){
  if (login && domain) {
    localStorage.setItem('tm_login', login);
    localStorage.setItem('tm_domain', domain);
  }
}
function loadState(){
  const l = localStorage.getItem('tm_login');
  const d = localStorage.getItem('tm_domain');
  if (l && d) {
    login = l; domain = d;
    addressText.textContent = `${login}@${domain}`;
    addressBox.style.display = '';
    copyBtn.style.display = '';
    newBtn.style.display = '';
    genBtn.style.display = 'none';
    startPolling();
  }
}
loadState();

// generate email
genBtn.addEventListener('click', () => {
  login = randStr(10);
  const domains = ['1secmail.com','1secmail.org','1secmail.net'];
  domain = domains[Math.floor(Math.random()*domains.length)];
  addressText.textContent = `${login}@${domain}`;
  addressBox.style.display = '';
  copyBtn.style.display = '';
  newBtn.style.display = '';
  genBtn.style.display = 'none';
  lastIds = new Set();
  statusEl.textContent = 'Polling every 3s...';
  saveState();
  startPolling();
});

// new email
newBtn.addEventListener('click', () => {
  clearInterval(pollTimer);
  login = null; domain = null;
  localStorage.removeItem('tm_login'); localStorage.removeItem('tm_domain');
  inboxList.innerHTML = 'No messages.';
  addressBox.style.display = 'none';
  copyBtn.style.display = 'none';
  newBtn.style.display = 'none';
  genBtn.style.display = '';
  statusEl.textContent = '';
});

// copy
copyBtn.addEventListener('click', async () => {
  const txt = addressText.textContent.trim();
  try {
    await navigator.clipboard.writeText(txt);
    statusEl.textContent = 'Copied address to clipboard';
  } catch(e){
    statusEl.textContent = 'Copy failed';
  }
});

// start polling
function startPolling(){
  if (!login || !domain) return;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(fetchInbox, 3000);
  fetchInbox(); // immediate
}

// fetch inbox
async function fetchInbox(){
  if (!login || !domain) return;
  const url = `https://www.1secmail.com/api/v1/?action=getMessages&login=${encodeURIComponent(login)}&domain=${encodeURIComponent(domain)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      statusEl.textContent = `Inbox fetch failed: ${res.status}`;
      return;
    }
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) {
      inboxList.innerHTML = 'No messages.';
      return;
    }

    // sort newest first
    arr.sort((a,b)=>b.date.localeCompare(a.date));

    // build UI
    inboxList.innerHTML = '';
    for (const msg of arr){
      const id = msg.id;
      const item = document.createElement('div');
      item.className = 'msgItem';

      const meta = document.createElement('div');
      meta.className = 'msgMeta';
      meta.innerHTML = `<div><strong>${escapeHtml(msg.from)}</strong></div>
                        <div style="color:var(--muted)">${escapeHtml(msg.subject)}</div>
                        <div style="font-size:12px;color:var(--muted)">${new Date(msg.date).toLocaleString()}</div>`;

      const actions = document.createElement('div');
      actions.className = 'msgActions';

      const openBtn = document.createElement('button');
      openBtn.className = 'btn';
      openBtn.textContent = 'Open';
      openBtn.onclick = () => openMessage(id);

      const delBtn = document.createElement('button');
      delBtn.className = 'btn';
      delBtn.textContent = 'Delete';
      delBtn.onclick = () => deleteMessage(id);

      actions.appendChild(openBtn);
      actions.appendChild(delBtn);

      item.appendChild(meta);
      item.appendChild(actions);

      inboxList.appendChild(item);
    }

  } catch (e) {
    console.error('fetchInbox err', e);
    statusEl.textContent = 'Network error while fetching inbox';
  }
}

// open message details
async function openMessage(id){
  if (!login || !domain) return;
  const url = `https://www.1secmail.com/api/v1/?action=readMessage&login=${encodeURIComponent(login)}&domain=${encodeURIComponent(domain)}&id=${id}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      statusEl.textContent = `Message fetch failed: ${res.status}`;
      return;
    }
    const data = await res.json();
    mFrom.textContent = data.from || '';
    mSub.textContent = data.subject || '';
    const text = data.textBody || '';
    const html = data.htmlBody || '';

    // display body: prefer text, if html exists show sanitized html
    if (html) {
      // parse html and show limited content
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      // remove scripts
      doc.querySelectorAll('script,iframe').forEach(n=>n.remove());
      mBody.innerHTML = doc.body.innerHTML || escapeHtml(text || html);
    } else {
      mBody.textContent = text || '[no body]';
    }

    // extract OTP using regex (common 4-8 digit)
    const otp = extractOtp(text + ' ' + (html || ''));
    mOtp.textContent = otp || '-';
    viewer.style.display = '';
  } catch (e) {
    console.error('openMessage err', e);
    statusEl.textContent = 'Error reading message';
  }
}

// delete (1secmail supports delete)
async function deleteMessage(id){
  if (!login || !domain) return;
  const url = `https://www.1secmail.com/api/v1/?action=deleteMessage&login=${encodeURIComponent(login)}&domain=${encodeURIComponent(domain)}&id=${id}`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      statusEl.textContent = 'Message deleted';
      fetchInbox();
    } else {
      statusEl.textContent = 'Delete failed';
    }
  } catch (e) {
    console.error('deleteMessage err', e);
    statusEl.textContent = 'Network delete error';
  }
}

// close viewer
closeMsg.addEventListener('click', () => {
  viewer.style.display = 'none';
});

// download message as .txt
downloadMsg.addEventListener('click', () => {
  const from = mFrom.textContent || '';
  const subject = mSub.textContent || '';
  const body = mBody.textContent || mBody.innerText || '';
  const content = `From: ${from}\nSubject: ${subject}\n\n${body}`;
  const blob = new Blob([content], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${subject || 'message'}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// helper: extract OTP 4-8 digits
function extractOtp(text){
  if (!text) return null;
  // common patterns: code: 123456 ; verification code 1234
  const patterns = [
    /\b(\d{4,8})\b/g, // any 4-8 digit
  ];
  for (const rx of patterns){
    let m;
    while ((m = rx.exec(text)) !== null){
      // skip long runs (but pattern already 4-8)
      const code = m[1] || m[0];
      if (code && code.length >=4 && code.length <=8) return code;
    }
  }
  return null;
}

// helper: escape
function escapeHtml(s){
  if (!s) return '';
  return s.replace(/[&<>"']/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
