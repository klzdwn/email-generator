// app.js - Static 1secmail demo (minimal, polling + otp extract)
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

let login = null, domain = null, pollTimer = null;

function randStr(len = 10){
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i=0;i<len;i++) s+=chars[Math.floor(Math.random()*chars.length)];
  return s;
}

function saveState(){ if(login&&domain){localStorage.setItem('tm_login',login);localStorage.setItem('tm_domain',domain);} }
function loadState(){
  const l = localStorage.getItem('tm_login'), d = localStorage.getItem('tm_domain');
  if (l && d) { login = l; domain = d; addressText.textContent = `${login}@${domain}`; addressBox.style.display=''; copyBtn.style.display=''; newBtn.style.display=''; genBtn.style.display='none'; startPolling(); }
}
loadState();

genBtn.addEventListener('click', ()=>{
  login = randStr(10);
  const domains = ['1secmail.com','1secmail.org','1secmail.net'];
  domain = domains[Math.floor(Math.random()*domains.length)];
  addressText.textContent = `${login}@${domain}`;
  addressBox.style.display=''; copyBtn.style.display=''; newBtn.style.display=''; genBtn.style.display='none';
  statusEl.textContent = 'Polling every 3s...';
  saveState();
  startPolling();
});

newBtn && newBtn.addEventListener('click', ()=>{
  clearInterval(pollTimer);
  localStorage.removeItem('tm_login'); localStorage.removeItem('tm_domain');
  login = domain = null;
  inboxList.innerHTML = 'No messages.';
  addressBox.style.display='none'; copyBtn.style.display='none'; newBtn.style.display='none'; genBtn.style.display='';
  statusEl.textContent = '';
});

copyBtn && copyBtn.addEventListener('click', async ()=>{
  try{ await navigator.clipboard.writeText(addressText.textContent.trim()); statusEl.textContent='Copied.' }catch(e){ statusEl.textContent='Copy failed'; }
});

function startPolling(){
  if(!login||!domain) return;
  if(pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(fetchInbox,3000);
  fetchInbox();
}

async function fetchInbox(){
  if(!login||!domain) return;
  const url = `https://www.1secmail.com/api/v1/?action=getMessages&login=${encodeURIComponent(login)}&domain=${encodeURIComponent(domain)}`;
  try{
    const res = await fetch(url);
    if(!res.ok){ statusEl.textContent = `Inbox fetch failed: ${res.status}`; return; }
    const arr = await res.json();
    if(!Array.isArray(arr)||arr.length===0){ inboxList.innerHTML='No messages.'; return; }
    arr.sort((a,b)=>b.date.localeCompare(a.date));
    inboxList.innerHTML = '';
    for(const msg of arr){
      const item = document.createElement('div'); item.className='msgItem';
      const meta = document.createElement('div'); meta.innerHTML = `<div><strong>${escapeHtml(msg.from)}</strong></div><div class="muted">${escapeHtml(msg.subject)}</div><div class="muted" style="font-size:12px">${new Date(msg.date).toLocaleString()}</div>`;
      const actions = document.createElement('div');
      const open = document.createElement('button'); open.className='btn'; open.textContent='Open';
      open.onclick = ()=>openMessage(msg.id);
      const del = document.createElement('button'); del.className='btn'; del.textContent='Delete';
      del.onclick = ()=>deleteMessage(msg.id);
      actions.appendChild(open); actions.appendChild(del);
      item.appendChild(meta); item.appendChild(actions);
      inboxList.appendChild(item);
    }
  }catch(e){
    console.error(e);
    statusEl.textContent = 'Network error while fetching inbox';
  }
}

async function openMessage(id){
  const url = `https://www.1secmail.com/api/v1/?action=readMessage&login=${encodeURIComponent(login)}&domain=${encodeURIComponent(domain)}&id=${id}`;
  try{
    const res = await fetch(url);
    if(!res.ok){ statusEl.textContent = `Message fetch failed: ${res.status}`; return; }
    const d = await res.json();
    mFrom.textContent = d.from || '';
    mSub.textContent = d.subject || '';
    const text = d.textBody || '';
    const html = d.htmlBody || '';
    if(html){
      const parser = new DOMParser(); const doc = parser.parseFromString(html,'text/html'); doc.querySelectorAll('script,iframe').forEach(n=>n.remove());
      mBody.innerHTML = doc.body.innerHTML || escapeHtml(text||html);
    } else {
      mBody.textContent = text || '[no body]';
    }
    const otp = extractOtp((text||'') + ' ' + (html||''));
    mOtp.textContent = otp || '-';
    viewer.style.display = '';
  }catch(e){ console.error(e); statusEl.textContent='Error reading message'; }
}

async function deleteMessage(id){
  const url = `https://www.1secmail.com/api/v1/?action=deleteMessage&login=${encodeURIComponent(login)}&domain=${encodeURIComponent(domain)}&id=${id}`;
  try{
    const res = await fetch(url);
    if(res.ok){ statusEl.textContent='Message deleted'; fetchInbox(); } else { statusEl.textContent='Delete failed'; }
  }catch(e){ statusEl.textContent='Network delete error'; }
}

closeMsg && closeMsg.addEventListener('click', ()=>viewer.style.display='none');

downloadMsg && downloadMsg.addEventListener('click', ()=>{
  const from = mFrom.textContent||'';
  const subject = mSub.textContent||'';
  const body = mBody.textContent || mBody.innerText || '';
  const content = `From: ${from}\nSubject: ${subject}\n\n${body}`;
  const blob = new Blob([content],{type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${subject||'message'}.txt`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

function extractOtp(text){
  if(!text) return null;
  const rx = /\b(\d{4,8})\b/g;
  let m;
  while((m=rx.exec(text)) !== null){
    if(m[1]) return m[1];
  }
  return null;
}

function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
