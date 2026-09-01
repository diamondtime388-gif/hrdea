"use client";

import { useRef, useState } from "react";
import { generateKeyFile, loadKeyFile } from "../lib/crypto";

export default function UnlockScreen({ onUnlock }) {
  const fileInput = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [freshBlob, setFreshBlob] = useState(null);

  async function handleGenerate() {
    setBusy(true);
    setError("");
    try {
      const { blob, publicKey } = await generateKeyFile();
      setFreshBlob(blob);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `cipher-thread-key-${Date.now()}.json`;
      a.click();
      const identity = await loadKeyFile(new File([blob], "key.json"));
      onUnlock(identity);
    } catch (e) {
      setError("Could not generate a key file. " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const identity = await loadKeyFile(file);
      onUnlock(identity);
    } catch (e) {
      setError("This key file could not be read. It may be corrupted or from a different site.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 24,
        textAlign: "center",
      }}
    >
      <div>
        <div className="mono" style={{ color: "var(--accent)", fontSize: 13, letterSpacing: 1 }}>
          cipher thread
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 600, margin: "8px 0 4px" }}>Unlock your vault</h1>
        <p style={{ color: "var(--text-dim)", maxWidth: 340, fontSize: 14, lineHeight: 1.5 }}>
          Your accounts and chats are unlocked with a key file that lives only on your device.
          There is no password reset — losing the file means losing access.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 280 }}>
        <button
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          style={{
            background: "var(--accent)",
            color: "#08110f",
            border: "none",
            borderRadius: "var(--radius)",
            padding: "12px 16px",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Load key file
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          hidden
          onChange={handleFile}
        />

        <button
          onClick={handleGenerate}
          disabled={busy}
          style={{
            background: "transparent",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "12px 16px",
            fontSize: 14,
          }}
        >
          Create a new vault
        </button>
      </div>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: 13, maxWidth: 300 }}>{error}</p>
      )}
    </div>
  );
}
