// app.js - vanilla JS client for repo's /api endpoints
// If your API paths differ, update the constants below.

const API = {
  create: '/api/create',
  messages: '/api/messages',
  message: (id) => `/api/message/${id}`,
  delete: '/api/delete'
};

const el = id => document.getElementById(id);
const createBtn = el('createBtn');
const deleteBtn = el('deleteBtn');
const copyBtn = el('copyBtn');
const fetchBtn = el('fetchBtn');
const pollToggle = el('pollToggle');
const mailboxCard = el('mailboxCard');
const addressTxt = el('addressTxt');
const passwordTxt = el('passwordTxt');
const tokenTxt = el('tokenTxt');
const inboxList = el('inboxList');
const previewCard = el('previewCard');
const previewSubject = el('previewSubject');
const previewFrom = el('previewFrom');
const previewBody = el('previewBody');
const extractOtpBtn = el('extractOtpBtn');
const copyBodyBtn = el('copyBodyBtn');
const toastEl = el('toast');
const themeToggle = el('themeToggle');

let mailbox = null;
let pollInterval = null;
let currentMessages = [];
let currentPreview = null;

// small helpers
function toast(msg, time = 2500){
  toastEl.hidden = false;
  toastEl.textContent = msg;
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(()=> toastEl.hidden = true, time);
}
async function safeJson(resp){
  const txt = await resp.text();
  try { return JSON.parse(txt || '{}'); } catch(e){ return { raw: txt }; }
}
function setMailbox(info){
  mailbox = info;
  if(!mailbox) {
    mailboxCard.hidden = true;
    addressTxt.textContent = '';
    passwordTxt.textContent = '';
    tokenTxt.textContent = '';
    return;
  }
  mailboxCard.hidden = false;
  addressTxt.textContent = mailbox.address || '';
  passwordTxt.textContent = mailbox.password ? '••••••••' : '';
  tokenTxt.textContent = mailbox.token ? (mailbox.token.slice(0,24) + '…') : '';
  toast('Mailbox ready');
}

async function createMailbox(){
  createBtn.disabled = true;
  toast('Creating mailbox...');
  try {
    const resp = await fetch(API.create, { method:'POST' });
    if(!resp.ok) {
      const d = await safeJson(resp);
      throw new Error(d?.error || `Create failed (${resp.status})`);
    }
    const data = await resp.json();
    // Expecting { address, password, token }
    setMailbox(data);
    localStorage.setItem('tm_mailbox', JSON.stringify(data));
    await fetchMessages();
  } catch(err){
    console.error(err);
    toast('Create mailbox failed: ' + err.message);
  } finally { createBtn.disabled = false; }
}

async function deleteMailbox(){
  if(!mailbox) return toast('No mailbox to delete');
  deleteBtn.disabled = true;
  try {
    // try POST /api/delete with token (fallback if API differs)
    const resp = await fetch(API.delete, {
      method:'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ token: mailbox.token })
    });
    if(resp.ok){
      setMailbox(null);
      localStorage.removeItem('tm_mailbox');
      inboxList.innerHTML = '<div class="empty">No messages.</div>';
      previewCard.hidden = true;
      toast('Mailbox deleted');
    } else {
      // fallback: just clear locally
      setMailbox(null);
      localStorage.removeItem('tm_mailbox');
      inboxList.innerHTML = '<div class="empty">No messages.</div>';
      previewCard.hidden = true;
      toast('Cleared locally (server delete failed)');
    }
  } catch(err){
    console.error(err);
    toast('Delete error');
  } finally { deleteBtn.disabled = false; }
}

function mailAuthHeaders(){
  const headers = {};
  if(mailbox && mailbox.token) headers['Authorization'] = 'Bearer ' + mailbox.token;
  return headers;
}

async function fetchMessages(){
  if(!mailbox) return toast('No mailbox. Create first.');
  fetchBtn.disabled = true;
  try {
    // try GET /api/messages with Authorization header
    const url = API.messages + (mailbox.token && '?token=' + encodeURIComponent(mailbox.token));
    const resp = await fetch(API.messages, { headers: mailAuthHeaders() });
    if(resp.status === 404){
      toast('Messages endpoint not found (404)');
      return;
    }
    const d = await safeJson(resp);
    if(!resp.ok) {
      console.error('messages error', d);
      toast('Fetch messages failed');
      return;
    }
    // Expecting array of messages
    const list = Array.isArray(d) ? d : (d?.messages || d?.body || []);
    currentMessages = list;
    renderInbox(list);
  } catch(err){
    console.error(err);
    toast('Fetch messages error');
  } finally { fetchBtn.disabled = false; }
}

function renderInbox(list){
  if(!list || !list.length){
    inboxList.innerHTML = '<div class="empty">No messages.</div>';
    return;
  }
  inboxList.innerHTML = '';
  list.forEach(m => {
    const card = document.createElement('div');
    card.className = 'msg-card';
    const html = `
      <div style="flex:1">
        <div class="title">${escapeHtml(m.subject || 'No subject')}</div>
        <div class="sub">${escapeHtml((m.from || m.sender || m.address || '') )} — ${formatTime(m.time || m.date)}</div>
      </div>
      <div><button class="btn viewBtn" data-id="${m.id || m.messageId || m.mid || m._id}">Open</button></div>
    `;
    card.innerHTML = html;
    inboxList.appendChild(card);
  });
  // attach open handlers
  inboxList.querySelectorAll('.viewBtn').forEach(b=>{
    b.addEventListener('click', ()=> openMessage(b.dataset.id));
  });
}

function formatTime(t){
  if(!t) return '';
  try{
    const d = new Date(t);
    if(isNaN(d)) return t;
    return d.toLocaleString();
  }catch(e){return t}
}

async function openMessage(id){
  if(!id) return;
  previewCard.hidden = false;
  previewSubject.textContent = 'Loading...';
  previewFrom.textContent = '';
  previewBody.innerHTML = '';
  try {
    // try header auth first, then fallback to ?token=
    let resp = await fetch(API.message(id), { headers: mailAuthHeaders() });
    if(resp.status === 404){
      // fallback: try GET /api/message?id=...&token=...
      const fallback = `/api/message?id=${encodeURIComponent(id)}&token=${encodeURIComponent(mailbox?.token||'')}`;
      resp = await fetch(fallback);
    }
    if(!resp.ok){
      const d = await safeJson(resp);
      throw new Error(d?.error || `Message fetch failed (${resp.status})`);
    }
    const d = await resp.json();
    // message format: { subject, from, html, text, body }
    const subject = d.subject || d.title || 'No subject';
    const from = d.from || d.sender || d.fromName || '';
    const body = d.html || d.body || d.text || '';
    currentPreview = { id, subject, from, body };
    previewSubject.textContent = subject;
    previewFrom.textContent = from;
    previewBody.innerHTML = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  } catch(err){
    console.error(err);
    previewSubject.textContent = 'Error loading message';
    previewBody.textContent = String(err.message || err);
    toast('Open message failed');
  }
}

async function extractOtp(){
  if(!currentPreview) return toast('No message open');
  const text = previewBody.innerText || previewBody.textContent || '';
  // regex: 4-8 digit codes; also tries common OTP formats
  const re = /(?:(?:\b|[^0-9])([0-9]{4,8})(?:\b|[^0-9]))/g;
  let match, found;
  while((match = re.exec(text)) !== null){
    const val = match[1];
    // ignore long sequences that are probably not OTP > 8
    if(val && val.length>=4 && val.length<=8){
      found = val; break;
    }
  }
  if(found){
    await navigator.clipboard.writeText(found).catch(()=>null);
    toast('OTP copied: ' + found);
  } else {
    toast('No OTP found');
  }
}

function escapeHtml(s=''){
  return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

copyBtn.addEventListener('click', async ()=>{
  if(!mailbox || !mailbox.address) return toast('No address to copy');
  try {
    await navigator.clipboard.writeText(mailbox.address);
    toast('Address copied');
  } catch(e){
    toast('Clipboard failed');
  }
});

fetchBtn.addEventListener('click', fetchMessages);
createBtn.addEventListener('click', createMailbox);
deleteBtn.addEventListener('click', deleteMailbox);
extractOtpBtn.addEventListener('click', extractOtp);
copyBodyBtn.addEventListener('click', async ()=>{
  if(!currentPreview) return toast('No message open');
  await navigator.clipboard.writeText(previewBody.innerText || previewBody.textContent || '');
  toast('Message copied');
});

// polling
pollToggle.addEventListener('change', ()=>{
  if(pollToggle.checked) startPolling(); else stopPolling();
});
function startPolling(){
  stopPolling();
  pollInterval = setInterval(()=> fetchMessages(), 3500);
}
function stopPolling(){ if(pollInterval){ clearInterval(pollInterval); pollInterval = null; } }

// theme toggle
themeToggle.addEventListener('click', ()=>{
  document.body.classList.toggle('light');
  themeToggle.textContent = document.body.classList.contains('light') ? '🌙' : '☀️';
});

// load cached mailbox
(function init(){
  const cached = localStorage.getItem('tm_mailbox');
  if(cached){
    try { setMailbox(JSON.parse(cached)); fetchMessages(); } catch(e){}
  }
  if(pollToggle.checked) startPolling();
})();
