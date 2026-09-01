"use client";

import { useState } from "react";

export default function AccountSwitcher({ accounts, currentId, onSwitch, onCreate }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await onCreate(name.trim());
    setBusy(false);
    setName("");
    setCreating(false);
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "transparent",
          border: "none",
          color: "var(--text)",
          padding: "10px 14px",
          width: "100%",
          textAlign: "left",
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "var(--accent-dim)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {(accounts.find((a) => a.id === currentId)?.display_name || "?")[0]?.toUpperCase()}
        </span>
        <span style={{ fontSize: 14, fontWeight: 500 }}>
          {accounts.find((a) => a.id === currentId)?.display_name || "Select account"}
        </span>
        <span style={{ marginLeft: "auto", color: "var(--text-dim)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 8,
            right: 8,
            background: "var(--bg-raised)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: 6,
            zIndex: 10,
          }}
        >
          {accounts.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                onSwitch(a.id);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: a.id === currentId ? "var(--bg-input)" : "transparent",
                border: "none",
                color: "var(--text)",
                padding: "8px 10px",
                borderRadius: 6,
                fontSize: 14,
              }}
            >
              {a.display_name}
            </button>
          ))}

          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                color: "var(--accent)",
                padding: "8px 10px",
                fontSize: 14,
              }}
            >
              + Create account
            </button>
          ) : (
            <form onSubmit={submit} style={{ padding: "6px 4px" }}>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Account name"
                maxLength={64}
                style={{
                  width: "100%",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text)",
                  padding: "8px 10px",
                  fontSize: 14,
                  marginBottom: 6,
                }}
              />
              <button
                type="submit"
                disabled={busy}
                style={{
                  width: "100%",
                  background: "var(--accent)",
                  border: "none",
                  borderRadius: 6,
                  color: "#08110f",
                  padding: "8px 10px",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {busy ? "Creating…" : "Create"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
