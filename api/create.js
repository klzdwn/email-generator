export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1) Register account
    const register = await fetch("https://api.mail.tm/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: `user_${Date.now()}@1secmail.com`,
        password: "Password123!",
      }),
    });

    const regData = await register.json();

    if (!register.ok) {
      return res.status(500).json({
        error: "create_failed",
        detail: regData,
      });
    }

    // 2) Login (get token)
    const login = await fetch("https://api.mail.tm/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: regData.address,
        password: "Password123!",
      }),
    });

    const loginData = await login.json();

    if (!login.ok) {
      return res.status(500).json({
        error: "login_failed",
        detail: loginData,
      });
    }

    return res.status(200).json({
      address: regData.address,
      id: regData.id,
      token: loginData.token,
    });

  } catch (e) {
    return res.status(500).json({ error: "server_error", detail: e.message });
  }
}
