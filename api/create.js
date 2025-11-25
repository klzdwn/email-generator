// create random 1secmail email
export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  fetch("https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1")
    .then(r => r.json())
    .then(([email]) => {
      const [login, domain] = email.split("@");
      res.json({
        ok: true,
        address: email,
        login,
        domain
      });
    })
    .catch(err =>
      res.status(500).json({ ok: false, error: "create_failed", detail: err.toString() })
    );
}
