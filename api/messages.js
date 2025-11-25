export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Missing token" });
  }

  try {
    const inbox = await fetch("https://api.mail.tm/messages", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await inbox.json();

    return res.status(200).json({ messages: data });

  } catch (e) {
    return res.status(500).json({
      error: "server_error",
      detail: e.message,
    });
  }
}
