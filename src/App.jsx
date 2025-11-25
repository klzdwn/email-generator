import React, { useEffect, useState, useRef } from "react";

/**
 * TempMail frontend (integrasi dengan serverless API endpoints)
 *
 * Expects these endpoints in the same domain:
 * POST  /api/create            -> create mailbox, returns { address, token, password, id }
 * GET   /api/messages?token=.. -> list messages for token
 * GET   /api/message?id=..&token=.. -> message detail
 *
 * Behavior:
 * - create mailbox (stores token & address in localStorage)
 * - poll messages every 6s while token exists
 * - show inbox list + message preview
 * - copy address / copy message / download message
 *
 * Paste into src/App.jsx
 */

function useLocalStorage(key, initial = null) {
  const [val, setVal] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  }, [key, val]);
  return [val, setVal];
}

export default function App() {
  const [info, setInfo] = useLocalStorage("tm_info", null);
  // info = { address, token, password, id, createdAt }
  const [messages, setMessages] = useLocalStorage("tm_messages", []);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedFull, setSelectedFull] = useState(null);
  const [polling, setPolling] = useState(true);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingFetch, setLoadingFetch] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const pollRef = useRef(null);
  const previewRef = useRef();

  // Create mailbox using API
  async function createMailbox() {
    setLoadingCreate(true);
    try {
      const res = await fetch("/api/create", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "create failed");
      setInfo({ address: data.address, token: data.token, password: data.password, id: data.id, createdAt: Date.now() });
      setMessages([]);
      setSelectedId(null);
      setSelectedFull(null);
    } catch (err) {
      alert("Gagal membuat mailbox: " + (err.message || err));
      console.error(err);
    } finally {
      setLoadingCreate(false);
    }
  }

  // Copy text helper with feedback
  async function copyText(t, setter) {
    try {
      await navigator.clipboard.writeText(t);
      if (setter) {
        setter(true);
        setTimeout(() => setter(false), 1400);
      }
    } catch {
      alert("Tidak bisa menyalin");
    }
  }

  // Fetch messages (list) via API
  async function fetchMessagesOnce() {
    if (!info?.token) return;
    setLoadingFetch(true);
    try {
      const res = await fetch(`/api/messages?token=${encodeURIComponent(info.token)}`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "mail.tm returned error");
      }
      const items = await res.json();
      // normalize and keep newest first; merge without duplicates
      const seen = new Set();
      const normalized = items.map((m) => ({
        id: m.id,
        subject: m.subject || "(no subject)",
        from: m.from || "unknown",
        intro: m.intro || "",
        createdAt: m.createdAt || Date.now(),
      }));
      const merged = [...normalized, ...messages].filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      setMessages(merged.slice(0, 200));
    } catch (err) {
      console.error("fetch messages error", err);
    } finally {
      setLoadingFetch(false);
    }
  }

  // Fetch one message detail
  async function fetchMessageDetail(id) {
    if (!info?.token || !id) return;
    try {
      const res = await fetch(`/api/message?id=${encodeURIComponent(id)}&token=${encodeURIComponent(info.token)}`);
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "failed");
      }
      const data = await res.json();
      setSelectedFull(data);
      setSelectedId(id);
      // ensure this message exists in list
      setMessages((prev) => {
        if (prev.find((x) => x.id === id)) return prev;
        const m = {
          id: data.id,
          subject: data.subject || "(no subject)",
          from: (data.from && data.from.address) || data.from || "unknown",
          intro: data.intro || (data.text ? data.text.slice(0, 100) : ""),
          createdAt: data.createdAt || Date.now(),
        };
        return [m, ...prev].slice(0, 200);
      });
    } catch (err) {
      alert("Gagal ambil message: " + (err.message || err));
      console.error(err);
    }
  }

  // download message as .txt
  function downloadMessage(msg) {
    const bodyText = msg.text || msg.html || msg.intro || "";
    const payload = `From: ${msg.from?.address || msg.from || ""}\nTo: ${info?.address || ""}\nSubject: ${msg.subject || ""}\n\n${bodyText}`;
    const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(msg.subject || "message").replace(/[^a-z0-9_\- ]/gi, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Polling setup
  useEffect(() => {
    // clear any existing
    if (pollRef.current) clearTimeout(pollRef.current);
    let cancelled = false;

    async function loop() {
      if (cancelled) return;
      if (info?.token && polling) {
        await fetchMessagesOnce();
      }
      pollRef.current = setTimeout(loop, 6000);
    }
    loop();

    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info?.token, polling]);

  // If messages change and selectedId exists, refresh selectedFull if missing
  useEffect(() => {
    if (selectedId && !selectedFull) {
      fetchMessageDetail(selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, selectedId]);

  // Helper to clear local stored mailbox
  function clearLocalMailbox() {
    setInfo(null);
    setMessages([]);
    setSelectedId(null);
    setSelectedFull(null);
  }

  // UI render
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto">
        <header className="bg-white rounded-md p-4 shadow mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">TempMail (mail.tm)</h1>
            <p className="text-sm text-gray-600 mt-1">Temporary inbox example. Create a mailbox to receive real emails via mail.tm API.</p>
          </div>

          <div className="flex items-center gap-2">
            {!info && (
              <button onClick={createMailbox} disabled={loadingCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-md">
                {loadingCreate ? "Creating..." : "Create mailbox"}
              </button>
            )}

            {info && (
              <>
                <div className="font-mono bg-gray-100 px-3 py-2 rounded">{info.address}</div>
                <button onClick={() => copyText(info.address, setCopiedAddr)} className="px-3 py-2 border rounded">
                  {copiedAddr ? "Copied ✓" : "Copy"}
                </button>
                <button
                  onClick={() => {
                    // regenerate by creating a new mailbox (server will create new account)
                    if (confirm("Generate mailbox baru? Pesan saat ini akan tersimpan tapi mailbox baru dibuat.")) {
                      createMailbox();
                    }
                  }}
                  className="px-3 py-2 border rounded"
                >
                  Regenerate
                </button>
                <button onClick={clearLocalMailbox} className="px-3 py-2 border text-red-600 rounded">
                  Forget
                </button>
              </>
            )}
          </div>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Inbox list */}
          <section className="md:col-span-1">
            <div className="bg-white rounded-md shadow overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b">
                <div className="font-semibold">Inbox</div>
                <div className="flex items-center gap-2">
                  <button onClick={fetchMessagesOnce} disabled={!info?.token || loadingFetch} className="px-2 py-1 border rounded text-sm">
                    {loadingFetch ? "Loading..." : "Fetch"}
                  </button>
                  <label className="text-sm inline-flex items-center gap-2">
                    <input type="checkbox" checked={polling} onChange={(e) => setPolling(e.target.checked)} />
                    Poll
                  </label>
                </div>
              </div>

              <div className="max-h-[64vh] overflow-auto">
                {messages.length === 0 && <div className="p-4 text-gray-500">No messages yet.</div>}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      setSelectedId(m.id);
                      setSelectedFull(null);
                      fetchMessageDetail(m.id);
                    }}
                    className={`p-3 border-b cursor-pointer ${selectedId === m.id ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{m.subject}</div>
                        <div className="text-xs text-gray-500 truncate">{m.from} · {m.intro}</div>
                      </div>
                      <div className="text-xs text-gray-400 ml-3">{new Date(m.createdAt).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 text-sm text-gray-500">
              <p>Note: mailbox token stored in browser localStorage. If you clear storage, the mailbox token is lost.</p>
            </div>
          </section>

          {/* Preview */}
          <section className="md:col-span-2">
            <div className="bg-white rounded-md shadow p-4 min-h-[60vh]">
              {!info && <div className="text-gray-500">Create a mailbox to view real messages.</div>}

              {info && !selectedId && <div className="text-gray-500">Select a message to preview it. Click <strong>Fetch</strong> to query messages from mail.tm.</div>}

              {selectedId && selectedFull && (
                <article>
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">{selectedFull.subject}</h2>
                      <div className="text-sm text-gray-500">{(selectedFull.from && (selectedFull.from.address || selectedFull.from)) || "unknown"} • {new Date(selectedFull.createdAt).toLocaleString()}</div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => { navigator.clipboard.writeText(selectedFull.text || selectedFull.html || selectedFull.intro || ""); alert("Message copied."); }} className="px-3 py-1 border rounded">Copy</button>
                      <button onClick={() => downloadMessage(selectedFull)} className="px-3 py-1 border rounded">Download</button>
                      <button onClick={() => { setMessages(prev => prev.filter(p => p.id !== selectedId)); setSelectedId(null); setSelectedFull(null); }} className="px-3 py-1 border text-red-600 rounded">Delete</button>
                    </div>
                  </div>

                  <hr className="my-3" />

                  <div ref={previewRef} className="prose max-w-none">
                    {/* prefer showing plain text, fallback to html */}
                    {selectedFull.text ? (
                      <pre className="whitespace-pre-wrap">{selectedFull.text}</pre>
                    ) : selectedFull.html ? (
                      <div dangerouslySetInnerHTML={{ __html: selectedFull.html }} />
                    ) : (
                      <pre className="whitespace-pre-wrap">{selectedFull.intro || ""}</pre>
                    )}
                  </div>
                </article>
              )}

              {selectedId && !selectedFull && <div>Loading message…</div>}
            </div>
          </section>
        </main>

        <footer className="mt-6 text-sm text-gray-500 text-center">
          Made with ❤️ — mail.tm integration demo.
        </footer>
      </div>
    </div>
  );
}
