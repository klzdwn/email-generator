const $ = s => document.querySelector(s);
const createBtn = $('#createBtn');
const deleteBtn = $('#deleteBtn');
const copyBtn = $('#copyBtn');
const fetchBtn = $('#fetchBtn');
const pollCheckbox = $('#pollCheckbox');
const addressEl = $('#address');
const passwordEl = $('#password');
const tokenEl = $('#token');
const infoCard = $('#accountInfo');
const messagesEl = $('#messages');
const toastEl = $('#toast');
const themeToggle = $('#themeToggle');

let pollInterval = null;
let current = {
  address: localStorage.getItem('tm_address') || null,
  password: localStorage.getItem('tm_password') || null,
  token: localStorage.getItem('tm_token') || null
};

function showToast(txt){
  toastEl.textContent = txt;
  toastEl.style.display = 'block';
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(()=> toastEl.style.display='none', 3500);
}

function renderAccount(){
  if(current.address){
    infoCard.style.display = 'block';
    addressEl.textContent = current.address;
    passwordEl.textContent = current.password || '—';
    tokenEl.textContent = current.token ? current.token.slice(0,30)+'...' : '—';
  } else {
    infoCard.style.display = 'none';
  }
}

async function createMailbox(){
  showToast('Creating mailbox...');
  try{
    const res = await fetch('/api/create', { method:'POST' });
    const data = await res.json();
    if(!res.ok){
      showToast('Create failed: ' + (data?.error || res.statusText));
      console.error('create failed', data);
      return;
    }
    current.address = data.address;
    current.password = data.password;
    current.token = data.token;
    localStorage.setItem('tm_address', current.address);
    localStorage.setItem('tm_password', current.password);
    localStorage.setItem('tm_token', current.token);
    renderAccount();
    showToast('Mailbox created');
    fetchMessages();
    if(pollCheckbox.checked){
      startPolling();
    }
  }catch(err){
    console.error(err);
    showToast('Create failed: ' + err.message);
  }
}

async function deleteMailbox(){
  localStorage.removeItem('tm_address');
  localStorage.removeItem('tm_password');
  localStorage.removeItem('tm_token');
  current = {address:null,password:null,token:null};
  renderAccount();
  showToast('Local mailbox removed');
  stopPolling();
  messagesEl.innerHTML='No messages.';
}

async function fetchMessages(){
  messagesEl.innerHTML = 'Loading...';
  if(!current.token){ messagesEl.innerHTML='No token. Create mailbox first.'; return; }
  try{
    const res = await fetch('/api/messages', {
      headers: { 'authorization': 'Bearer ' + current.token }
    });
    const body = await res.json();
    if(!res.ok){
      messagesEl.innerHTML = 'Error loading messages.';
      console.error('messages error', body);
      showToast('Error loading messages: ' + (body?.error || res.statusText));
      return;
    }
    if(!body?.hydra: && !body?.hydra && Array.isArray(body) === false && body['hydra:member']){
      // new format
    }
    const list = body['hydra:member'] || body['items'] || body.results || body; // be resilient
    if(!list || list.length === 0){ messagesEl.innerHTML='No messages.'; return; }
    messagesEl.innerHTML = '';
    for(const m of list){
      const div = document.createElement('div');
      div.className = 'msg';
      div.innerHTML = `<div><strong>${m.subject||'(no subject)'}</strong></div>
                       <div style="font-size:12px;color:gray">${m.from?.address || m.from?.name || ''} — ${new Date(m.createdAt||m.created || m.date).toLocaleString()}</div>
                       <div style="margin-top:8px">${(m.intro || m.text || m.body || '')}</div>`;
      messagesEl.appendChild(div);
    }
  }catch(err){
    console.error(err);
    messagesEl.innerHTML = 'Error loading messages.';
    showToast('Fetch messages failed: ' + err.message);
  }
}

function startPolling(){
  stopPolling();
  pollInterval = setInterval(fetchMessages, 5000);
}
function stopPolling(){
  if(pollInterval){ clearInterval(pollInterval); pollInterval = null; }
}

createBtn.addEventListener('click', createMailbox);
deleteBtn.addEventListener('click', deleteMailbox);
fetchBtn.addEventListener('click', fetchMessages);
copyBtn.addEventListener('click', ()=>{
  if(current.address) navigator.clipboard?.writeText(current.address).then(()=>showToast('Copied'));
});

pollCheckbox.addEventListener('change', ()=>{
  if(pollCheckbox.checked) startPolling(); else stopPolling();
});

themeToggle.addEventListener('click', ()=>{
  const currentTheme = document.documentElement.getAttribute('data-theme');
  if(currentTheme === 'dark'){ document.documentElement.removeAttribute('data-theme'); themeToggle.textContent='🌙'; }
  else { document.documentElement.setAttribute('data-theme','dark'); themeToggle.textContent='☀️'; }
});

renderAccount();
if(current.token && pollCheckbox.checked) startPolling();
