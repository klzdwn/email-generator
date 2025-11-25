// app.js — client for mail.tm API via Vercel serverless

const $ = s => document.querySelector(s);

// UI Elements
const createBtn = $("#createBtn");
const deleteBtn = $("#deleteBtn");
const copyBtn = $("#copyBtn");
const fetchBtn = $("#fetchBtn");
const pollCheckbox = $("#pollCheckbox");

const addressEl = $("#address");
const passwordEl = $("#password");
const tokenEl = $("#token");
const messagesEl = $("#messages");

let poller = null;

let current = {
  address: localStorage.getItem("tm_address") || null,
  password: localStorage.getItem("tm_password") || null,
  token: localStorage.getItem("tm_token") || null,
};

// Update UI
function showInfo() {
  if (!current.address) {
    $("#infoBox").style.display = "none";
    return;
  }
  $("#infoBox").style.display = "block";
  addressEl.textContent = current.address;
  passwordEl.textContent = current.password;
  tokenEl.textContent = current.token;
}

// Fetch inbox
async function loadMessages() {
  if (!current.token) return;

  const r = await fetch(`/api/messages?token=${encodeURIComponent(current.token)}`);
  const j = await r.json();

  if (!j.ok) {
    messagesEl.innerHTML = "Error loading messages.";
    return;
  }

  if (!j.inbox.length) {
    messagesEl.innerHTML = "No messages.";
    return;
  }

  messagesEl.innerHTML = j.inbox
    .map(
      m => `
      <div class="card">
        <b>${m.from?.address || "(unknown)"}</b><br>
        <b>${m.subject || "(no subject)"}</b><br><br>
        <div>${m.intro || ""}</div>
      </div>
    `
    )
    .join("");
}

// CREATE MAILBOX
createBtn.onclick = async () => {
  const r = await fetch("/api/create", { method: "POST" });
  const j = await r.json();

  if (!j.ok) return alert("Create failed:\n" + j.error);

  current.address = j.address;
  current.password = j.password;
  current.token = j.token;

  localStorage.setItem("tm_address", j.address);
  localStorage.setItem("tm_password", j.password);
  localStorage.setItem("tm_token", j.token);

  showInfo();
  loadMessages();
};

// DELETE MAILBOX (local delete only)
deleteBtn.onclick = () => {
  localStorage.clear();
  current = { address: null, password: null, token: null };
  showInfo();
  messagesEl.innerHTML = "No messages.";
};

// COPY ADDRESS
copyBtn.onclick = () => {
  if (!current.address) return;
  navigator.clipboard.writeText(current.address);
  alert("Copied: " + current.address);
};

// MANUAL FETCH
fetchBtn.onclick = loadMessages;

// AUTO POLLING
setInterval(() => {
  if (pollCheckbox.checked) loadMessages();
}, 4000);

// Theme toggle
$("#themeToggle").onclick = () => {
  document.body.classList.toggle("dark");
};

// initial display
showInfo();
if (current.token) loadMessages();
