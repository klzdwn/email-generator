import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

export default function App() {
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [purpose, setPurpose] = useState("introduce");
  const [tone, setTone] = useState("professional");
  const [keyPoints, setKeyPoints] = useState("");
  const [generated, setGenerated] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [charLimit, setCharLimit] = useState(1500);
  const [includeSignature, setIncludeSignature] = useState(true);
  const [signature, setSignature] = useState("Best regards,\nYour Name\nCompany");

  const textareaRef = useRef(null);

  // Load saved history + signature
  useEffect(() => {
    const saved = localStorage.getItem("eg_history");
    const sig = localStorage.getItem("eg_signature");
    if (saved) setHistory(JSON.parse(saved));
    if (sig) setSignature(sig);
  }, []);

  useEffect(() => {
    localStorage.setItem("eg_history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem("eg_signature", signature);
  }, [signature]);

  function sanitizeText(t) {
    return t.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function makeSubject() {
    if (subject.trim()) return subject.trim();
    const base = {
      introduce: `Quick intro — ${recipientName || "a quick hello"}`,
      followup: `Following up on ${keyPoints.split(";")[0] || "our conversation"}`,
      pitch: `Proposal: ${keyPoints.split(";")[0] || "New idea"}`,
      thankyou: `Thank you — ${recipientName || "you"}`,
      reminder: `Friendly reminder: ${keyPoints.split(";")[0] || "next steps"}`,
    };
    return base[purpose] || "Hello";
  }

  function generateEmail() {
    setLoading(true);

    const rName = recipientName ? `Hi ${recipientName},` : "Hello,";
    const points = keyPoints
      .split(";")
      .map((p) => p.trim())
      .filter(Boolean);

    const openingByTone = {
      professional: [
        "I hope you're doing well.",
        "I hope this message finds you well.",
        "I hope all is well on your end.",
      ],
      friendly: [
        "Hope you're having a great day!",
        "How's everything going?",
        "Long time no chat — hope you're well!",
      ],
      casual: ["Hey!", "What's up?", "Quick note:"],
      persuasive: [
        "I wanted to share an opportunity I think you'd value.",
        "I believe the following could strongly benefit you.",
      ],
      apologetic: ["I'm sorry about the delay.", "Apologies for the inconvenience."],
    };

    const bodyByPurpose = {
      introduce: `I'm writing to introduce myself and share how I can help. ${
        points.length ? "Here are a few highlights:" : ""
      }`,
      followup: `Following up on our recent discussion. ${
        points.length ? "A reminder of the key items:" : ""
      }`,
      pitch: `I'd like to propose an idea that could bring value. ${
        points.length ? "Proposal summary:" : ""
      }`,
      thankyou: `Thank you for your time and help. I appreciate it and want to acknowledge:`,
      reminder: `Just a friendly reminder about the items below:`,
    };

    const openingOptions = openingByTone[tone] || openingByTone.professional;
    const opening = openingOptions[Math.floor(Math.random() * openingOptions.length)];

    let middle = "";
    if (points.length) {
      middle = points.map((p, i) => `${i + 1}. ${p}`).join("\n\n");
    } else {
      const fallback = {
        introduce:
          "I have experience in [your area] and would love to explore how I can support your goals.",
        followup: "Please let me know if you had a chance to review the materials.",
        pitch: "If this aligns with your priorities, I can prepare a short next-step plan.",
        thankyou: "Thanks again — I really appreciate your time and help.",
        reminder: "Could you confirm the planned date or next step?",
      };
      middle = fallback[purpose] || "I look forward to your response.";
    }

    const closingByTone = {
      professional: "Sincerely,",
      friendly: "Cheers,",
      casual: "Thanks,",
      persuasive: "Best regards,",
      apologetic: "With apologies,",
    };

    const closing = closingByTone[tone] || closingByTone.professional;

    let email = `${rName}\n\n${opening}\n\n${bodyByPurpose[purpose]}\n\n${middle}\n\n${closing}\n${
      includeSignature ? `\n${signature}` : ""
    }`;

    email = sanitizeText(email).slice(0, charLimit);

    const newGenerated = {
      timestamp: Date.now(),
      subject: makeSubject(),
      to: recipientEmail || "",
      body: email,
      inputs: { recipientName, recipientEmail, purpose, tone, keyPoints, signature },
    };

    setGenerated(email);
    setHistory((h) => [newGenerated, ...(h || []).slice(0, 9)]);
    setLoading(false);

    setTimeout(() => textareaRef.current && textareaRef.current.focus(), 120);
  }

  function copyToClipboard() {
    if (!generated) return;
    navigator.clipboard
      .writeText(`Subject: ${makeSubject()}\n\n${generated}`)
      .then(() => alert("Teks email disalin ke clipboard."))
      .catch(() => alert("Gagal menyalin ke clipboard."));
  }

  function downloadAsTxt() {
    const blob = new Blob([`Subject: ${makeSubject()}\n\n${generated}`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(subject || makeSubject()).replace(/[^a-z0-9\- ]/gi, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function useHistoryItem(item) {
    if (!item) return;
    setRecipientName(item.inputs.recipientName || "");
    setRecipientEmail(item.to || "");
    setPurpose(item.inputs.purpose || "introduce");
    setTone(item.inputs.tone || "professional");
    setKeyPoints(item.inputs.keyPoints || "");
    setSignature(item.inputs.signature || signature);
    setGenerated(item.body || "");
    setSubject(item.subject || "");
  }

  function clearAll() {
    if (!confirm("Hapus semua history dan formulir?")) return;
    setRecipientName("");
    setRecipientEmail("");
    setSubject("");
    setPurpose("introduce");
    setTone("professional");
    setKeyPoints("");
    setGenerated("");
    setHistory([]);
    localStorage.removeItem("eg_history");
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-bold mb-4"
      >
        Email Generator
      </motion.h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* LEFT SECTION */}
        <div className="md:col-span-2 space-y-4">
          {/* FORM */}
          <div className="bg-white p-4 rounded-2xl shadow">
            <label className="block text-sm font-medium">To (Nama)</label>
            <input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full mt-1 p-2 rounded-md border"
              placeholder="Nama penerima (contoh: Budi)"
            />

            <label className="block text-sm font-medium mt-3">To (Email)</label>
            <input
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full mt-1 p-2 rounded-md border"
              placeholder="email@domain.com"
            />

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-sm font-medium">Purpose</label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full mt-1 p-2 rounded-md border"
                >
                  <option value="introduce">Introduce</option>
                  <option value="followup">Follow-up</option>
                  <option value="pitch">Pitch / Proposal</option>
                  <option value="thankyou">Thank You</option>
                  <option value="reminder">Reminder</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium">Tone</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full mt-1 p-2 rounded-md border"
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="casual">Casual</option>
                  <option value="persuasive">Persuasive</option>
                  <option value="apologetic">Apologetic</option>
                </select>
              </div>
            </div>

            <label className="block text-sm font-medium mt-3">
              Key points (pisahkan dengan ; )
            </label>
            <textarea
              value={keyPoints}
              onChange={(e) => setKeyPoints(e.target.value)}
              className="w-full mt-1 p-2 rounded-md border min-h-[80px]"
              placeholder="Contoh: meeting on Friday; share draft; budget constraints"
            />

            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={generateEmail}
                className="px-4 py-2 rounded-2xl shadow bg-indigo-600 text-white"
              >
                {loading ? "Generating..." : "Generate"}
              </button>

              <button
                onClick={() => setGenerated("")}
                className="px-3 py-2 rounded-2xl border"
              >
                Clear
              </button>

              <label className="flex items-center gap-2 ml-4 text-sm">
                <input
                  type="checkbox"
                  checked={includeSignature}
                  onChange={(e) => setIncludeSignature(e.target.checked)}
                />
                Include signature
              </label>
            </div>
          </div>

          {/* PREVIEW */}
          <div className="bg-white p-4 rounded-2xl shadow">
            <div className="flex justify-between items-center">
              <h3 className="font-medium">Preview</h3>
              <div className="flex gap-2">
                <button onClick={copyToClipboard} className="px-3 py-1 rounded border">
                  Copy
                </button>
                <button onClick={downloadAsTxt} className="px-3 py-1 rounded border">
                  Download .txt
                </button>
              </div>
            </div>

            <label className="block text-sm font-medium mt-3">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={makeSubject()}
              className="w-full mt-1 p-2 rounded-md border"
            />

            <textarea
              ref={textareaRef}
              value={generated}
              onChange={(e) => setGenerated(e.target.value)}
              className="w-full mt-3 p-3 rounded-md border min-h-[220px] whitespace-pre-wrap"
            />

            <div className="flex justify-between text-sm mt-2">
              <div>
                Characters: {generated.length}/{charLimit}
              </div>
              <button
                onClick={() =>
                  setGenerated(
                    `Hello,\n\nThis is a sample email generated at ${new Date().toLocaleString()}.\n\nRegards,`
                  )
                }
                className="px-2 py-1 rounded border text-xs"
              >
                Insert sample
              </button>
            </div>
          </div>

          {/* SIGNATURE */}
          <div className="bg-white p-4 rounded-2xl shadow">
            <h3 className="font-medium">Signature</h3>
            <textarea
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="w-full mt-2 p-2 rounded-md border min-h-[80px]"
            />

            <div className="flex gap-2 mt-2">
              <button
                onClick={() =>
                  setSignature("Best regards,\nYour Name\nCompany")
                }
                className="px-3 py-1 rounded border"
              >
                Use default
              </button>

              <button
                onClick={() =>
                  navigator.clipboard
                    .writeText(signature)
                    .then(() => alert("Signature copied."))
                }
                className="px-3 py-1 rounded border"
              >
                Copy signature
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <aside className="space-y-4">
          {/* HISTORY */}
          <div className="bg-white p-4 rounded-2xl shadow">
            <h4 className="font-medium">History</h4>
            <div className="mt-2 space-y-2 max-h-[260px] overflow-auto">
              {history.length === 0 && (
                <div className="text-sm text-gray-500">No history yet</div>
              )}

              {history.map((h) => (
                <div key={h.timestamp} className="p-2 border rounded hover:bg-gray-50">
                  <div className="text-sm font-semibold">{h.subject}</div>
                  <div className="text-xs text-gray-500">To: {h.to || "-"}</div>

                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => useHistoryItem(h)}
                      className="text-xs px-2 py-1 rounded border"
                    >
                      Use
                    </button>
                    <button
                      onClick={() =>
                        setHistory((x) =>
                          x.filter((i) => i.timestamp !== h.timestamp)
                        )
                      }
                      className="text-xs px-2 py-1 rounded border"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between mt-3">
              <button onClick={clearAll} className="text-sm px-3 py-1 rounded border">
                Clear all
              </button>
              <div className="text-sm">Saved: {history.length}</div>
            </div>
          </div>

          {/* QUICK TEMPLATES */}
          <div className="bg-white p-4 rounded-2xl shadow">
            <h4 className="font-medium">Quick Templates</h4>

            <div className="grid gap-2 mt-2">
              <button
                onClick={() => {
                  setPurpose("introduce");
                  setTone("professional");
                  setKeyPoints("I help companies with X;Would love 20 minutes to discuss");
                }}
                className="text-sm px-3 py-2 rounded border text-left"
              >
                Intro — professional
              </button>

              <button
                onClick={() => {
                  setPurpose("followup");
                  setTone("friendly");
                  setKeyPoints("Following up on proposal;Any feedback?");
                }}
                className="text-sm px-3 py-2 rounded border text-left"
              >
                Follow-up — friendly
              </button>

              <button
                onClick={() => {
                  setPurpose("thankyou");
                  setTone("friendly");
                  setKeyPoints("Thanks for your help;Appreciate it");
                }}
                className="text-sm px-3 py-2 rounded border text-left"
              >
                Thank you
              </button>
            </div>
          </div>

          {/* SETTINGS */}
          <div className="bg-white p-4 rounded-2xl shadow">
            <h4 className="font-medium">Settings</h4>
            <label className="block text-sm mt-2">Character limit</label>

            <input
              type="range"
              min={200}
              max={5000}
              value={charLimit}
              onChange={(e) => setCharLimit(Number(e.target.value))}
            />

            <div className="text-xs">{charLimit} characters</div>
          </div>
        </aside>
      </div>

      <footer className="mt-6 text-center text-sm text-gray-500">
        Made with ❤️ — feel free to modify templates.
      </footer>
    </div>
  );
}
