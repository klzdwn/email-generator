// /api/create.js — Provider: 1SecMail
export default function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "method_not_allowed" });

  // generate username random
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let login = "";
  for (let i = 0; i < 10; i++)
    login += chars[Math.floor(Math.random() * chars.length)];

  const domain = "1secmail.com";
  const address = `${login}@${domain}`;

  return res.status(200).json({
    address,
    login,
    domain,
    provider: "1secmail"
  });
}
