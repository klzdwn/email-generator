async function createMailbox() {
  setLoading(true);
  try {
    const resp = await fetch("/api/create", { method: "POST" });
    const data = await resp.json();

    if (!resp.ok) {
      alert(
        "Gagal membuat mailbox:\n" +
        JSON.stringify(data, null, 2)
      );
      setLoading(false);
      return;
    }

    // SUCCESS
    setMailbox({
      address: data.address,
      token: data.token,
      id: data.id,
      password: data.password,
    });
    localStorage.setItem("mailbox", JSON.stringify(data));
  } catch (e) {
    alert("Error client:\n" + e.toString());
  }
  setLoading(false);
}
