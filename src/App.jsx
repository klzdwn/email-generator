// src/App.jsx
import React, { useState } from "react";

/**
 * Simple App component (default export)
 * - Memanggil /api/create ketika tombol "Create mailbox" diklik
 * - Menampilkan hasil (address / error detail)
 * - Export default di bagian akhir (penting)
 */

export function AppInner() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function createMailbox() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const resp = await fetch("/api/create", { method: "POST" });
      const data = await resp.json().catch(() => ({ error: "invalid_json" }));

      if (!resp.ok) {
        // tampilkan semua detail agar mudah debugging
        const pretty = JSON.stringify(data, null, 2);
        setError({ status: resp.status, detail: data, pretty });
        setLoading(false);
        return;
      }

      setResult(data);
    } catch (e) {
      setError({ fetchError: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, Arial", padding: 20 }}>
      <h1>TempMail (mail.tm)</h1>

      <div style={{ marginBottom: 12 }}>
        <button onClick={createMailbox} disabled={loading} style={{ padding: "8px 12px" }}>
          {loading ? "Creating..." : "Create mailbox"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>
          <strong>Gagal membuat mailbox:</strong>
          <div>{error.pretty || JSON.stringify(error, null, 2)}</div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 12, background: "#f6f6f6", padding: 12 }}>
          <div><strong>Address:</strong> {result.address}</div>
          <div><strong>Password:</strong> {result.password}</div>
          <div><strong>Token:</strong> {result.token}</div>
          <div style={{ marginTop: 8 }}>
            <button onClick={() => { navigator.clipboard?.writeText(result.address) }}>
              Copy address
            </button>
          </div>
        </div>
      )}

      <hr style={{ marginTop: 24 }} />
      <small>Debug mode: shows full error details for troubleshooting.</small>
    </div>
  );
}

// **PENTING** — default export supaya import di main.jsx berhasil
export default AppInner;
