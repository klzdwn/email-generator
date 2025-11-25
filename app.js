const genBtn = document.getElementById("genBtn");
const copyBtn = document.getElementById("copyBtn");
const emailContainer = document.getElementById("emailContainer");
const emailSpan = document.getElementById("email");
const inbox = document.getElementById("inbox");

let login = "";
let domain = "";
let timer = null;

// random string
function randStr(len = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz1234567890";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// generate email
genBtn.onclick = () => {
  login = randStr(10);
  const domains = ["1secmail.com", "1secmail.net", "1secmail.org"];
  domain = domains[Math.floor(Math.random() * domains.length)];

  const email = `${login}@${domain}`;
  emailSpan.textContent = email;
  emailContainer.classList.remove("hidden");

  startPolling();
};

// copy email
copyBtn.onclick = () => {
  navigator.clipboard.writeText(emailSpan.textContent);
  alert("Copied!");
};

// polling
async function startPolling() {
  if (timer) clearInterval(timer);

  timer = setInterval(async () => {
    const url = `https://www.1secmail.com/api/v1/?action=getMessages&login=${login}&domain=${domain}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      inbox.innerHTML = "";

      if (data.length === 0) {
        inbox.innerHTML = "No messages.";
        return;
      }

      data.forEach(async (msg) => {
        const div = document.createElement("div");
        div.className = "msg";

        div.innerHTML = `
          <strong>From:</strong> ${msg.from}<br>
          <strong>Subject:</strong> ${msg.subject}<br>
          <button onclick="readMessage(${msg.id})">Open</button>
        `;

        inbox.appendChild(div);
      });

    } catch (e) {
      console.error(e);
    }

  }, 3000);
}

// read message
async function readMessage(id) {
  const url = `https://www.1secmail.com/api/v1/?action=readMessage&login=${login}&domain=${domain}&id=${id}`;

  const res = await fetch(url);
  const data = await res.json();

  alert(
    `From: ${data.from}\nSubject: ${data.subject}\n\n${data.textBody || data.htmlBody}`
  );
}
