"use client";

import { useState } from "react";

export default function ChatList({ chats, currentChatId, onSelect, onCreate }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [lockType, setLockType] = useState("manual");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || !password) return;
    setBusy(true);
    await onCreate({ name: name.trim(), lockType, password });
    setBusy(false);
    setCreating(false);
    setName("");
    setPassword("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 13, color: "var(--text-dim)", fontWeight: 600 }}>CHATS</span>
        <button
          onClick={() => setCreating((v) => !v)}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--accent)",
            fontSize: 18,
            lineHeight: 1,
          }}
          aria-label="New chat"
        >
          +
        </button>
      </div>

      {creating && (
        <form onSubmit={submit} style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Chat name"
            style={inputStyle}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Chat password"
            style={{ ...inputStyle, marginTop: 8 }}
          />
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 13 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="radio"
                checked={lockType === "manual"}
                onChange={() => setLockType("manual")}
              />
              Ask every time
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="radio"
                checked={lockType === "cached"}
                onChange={() => setLockType("cached")}
              />
              Remember on this device
            </label>
          </div>
          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 10,
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
            {busy ? "Creating…" : "Create chat"}
          </button>
        </form>
      )}

      <div style={{ overflowY: "auto", flex: 1 }}>
        {chats.length === 0 && !creating && (
          <p style={{ color: "var(--text-dim)", fontSize: 13, padding: 16 }}>
            No chats yet. Tap + to start one.
          </p>
        )}
        {chats.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              background: c.id === currentChatId ? "var(--bg-input)" : "transparent",
              border: "none",
              borderBottom: "1px solid var(--border)",
              color: "var(--text)",
              padding: "12px 14px",
              fontSize: 14,
            }}
          >
            {c.name}
            <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
              {c.lock_type === "manual" ? "password · asks every time" : "password · remembered"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: "var(--bg-input)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text)",
  padding: "8px 10px",
  fontSize: 14,
};
