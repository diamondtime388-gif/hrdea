"use client";

import { useEffect, useRef, useState } from "react";
import {
  deriveKey,
  encryptDouble,
  decryptDoubleToString,
  unwrapChatKey,
} from "../lib/crypto";
import { cacheChatKey, getCachedChatKey } from "../lib/keystore";

const dec = new TextDecoder();

export default function ChatView({ chat, account, onBack }) {
  const [chatKey, setChatKey] = useState(null);
  const [passwordPrompt, setPasswordPrompt] = useState(false);
  const [password, setPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const fileInput = useRef(null);
  const scrollRef = useRef(null);

  // Try the local cache first for "cached" chats; otherwise prompt for the password.
  useEffect(() => {
    setChatKey(null);
    setMessages([]);
    setPasswordPrompt(false);
    setLoading(true);

    (async () => {
      if (chat.lock_type === "cached") {
        const cached = await getCachedChatKey(chat.id);
        if (cached) {
          setChatKey(cached);
          return;
        }
      }
      setPasswordPrompt(true);
      setLoading(false);
    })();
  }, [chat.id]);

  async function unlock(e) {
    e?.preventDefault();
    setUnlockError("");
    try {
      const memberKey = await deriveKey(password, chat.kdf_salt);
      const wrapped = JSON.parse(chat.wrapped_chat_key);
      const key = await unwrapChatKey(memberKey, wrapped);
      setChatKey(key);
      setPasswordPrompt(false);
      if (chat.lock_type === "cached") {
        await cacheChatKey(chat.id, key);
      }
    } catch (err) {
      setUnlockError("Wrong password, or this chat was locked with a different key.");
    }
  }

  useEffect(() => {
    if (!chatKey) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/messages?chatId=${chat.id}`);
      const { messages: rows } = await res.json();
      const decrypted = [];
      for (const m of rows) {
        try {
          if (m.msg_type === "text") {
            const plain = await decryptDoubleToString(chatKey, {
              ciphertext: m.ciphertext,
              outerNonce: m.outer_nonce,
              innerNonce: m.inner_nonce,
            });
            decrypted.push({ ...m, plain });
          } else {
            decrypted.push({ ...m, plain: null, imageDataUrl: null, raw: m });
          }
        } catch {
          decrypted.push({ ...m, plain: "[could not decrypt]" });
        }
      }
      if (!cancelled) {
        setMessages(decrypted);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatKey, chat.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function sendText() {
    if (!text.trim() || !chatKey) return;
    const envelope = await encryptDouble(chatKey, text.trim());
    const body = {
      chatId: chat.id,
      senderId: account.id,
      msgType: "text",
      ciphertext: envelope.ciphertext,
      outerNonce: envelope.outerNonce,
      innerNonce: envelope.innerNonce,
    };
    setText("");
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const { message } = await res.json();
    setMessages((prev) => [
      ...prev,
      { ...message, msg_type: "text", sender_id: account.id, created_at: message.createdAt, plain: text.trim() },
    ]);
  }

  async function sendImage(file) {
    if (!chatKey) return;
    const compressed = await compressImage(file);
    const buf = new Uint8Array(await compressed.arrayBuffer());
    const envelope = await encryptDouble(chatKey, buf);
    const body = {
      chatId: chat.id,
      senderId: account.id,
      msgType: "image",
      ciphertext: envelope.ciphertext,
      outerNonce: envelope.outerNonce,
      innerNonce: envelope.innerNonce,
    };
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const { message } = await res.json();
    const dataUrl = URL.createObjectURL(compressed);
    setMessages((prev) => [
      ...prev,
      {
        ...message,
        msg_type: "image",
        sender_id: account.id,
        created_at: message.createdAt,
        imageDataUrl: dataUrl,
      },
    ]);
  }

  if (passwordPrompt) {
    return (
      <div className="chat-pane" style={{ padding: 20 }}>
        <BackButton onBack={onBack} />
        <div style={{ maxWidth: 320, margin: "60px auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>{chat.name}</h2>
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 16 }}>
            Enter the chat password to decrypt.
          </p>
          <form onSubmit={unlock}>
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                background: "var(--bg-input)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text)",
                padding: "10px 12px",
                fontSize: 14,
              }}
            />
            <button
              type="submit"
              style={{
                marginTop: 10,
                width: "100%",
                background: "var(--accent)",
                border: "none",
                borderRadius: 6,
                color: "#08110f",
                padding: "10px 12px",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Unlock chat
            </button>
          </form>
          {unlockError && (
            <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{unlockError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="chat-pane">
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <BackButton onBack={onBack} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>{chat.name}</span>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        {loading && <p style={{ color: "var(--text-dim)", fontSize: 13 }}>Decrypting…</p>}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              justifyContent: m.sender_id === account.id ? "flex-end" : "flex-start",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                maxWidth: "70%",
                background: m.sender_id === account.id ? "var(--accent-dim)" : "var(--bg-raised)",
                borderRadius: 12,
                padding: m.msg_type === "image" ? 6 : "8px 12px",
                fontSize: 14,
              }}
            >
              {m.msg_type === "text" ? (
                m.plain
              ) : m.imageDataUrl ? (
                <img
                  src={m.imageDataUrl}
                  alt="sent image"
                  style={{ maxWidth: "100%", borderRadius: 8, display: "block" }}
                />
              ) : (
                <span style={{ color: "var(--text-dim)" }}>[encrypted image]</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--border)" }}>
        <button
          onClick={() => fileInput.current?.click()}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--text-dim)",
            padding: "0 12px",
            fontSize: 18,
          }}
          aria-label="Attach image"
        >
          +
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) sendImage(f);
            e.target.value = "";
          }}
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendText()}
          placeholder="Message"
          style={{
            flex: 1,
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--text)",
            padding: "10px 12px",
            fontSize: 14,
          }}
        />
        <button
          onClick={sendText}
          style={{
            background: "var(--accent)",
            border: "none",
            borderRadius: 8,
            color: "#08110f",
            padding: "0 16px",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function BackButton({ onBack }) {
  return (
    <button
      onClick={onBack}
      className="back-only-narrow"
      style={{
        background: "transparent",
        border: "none",
        color: "var(--text-dim)",
        fontSize: 18,
      }}
      aria-label="Back to chat list"
    >
      ←
    </button>
  );
}

// Downscale + re-encode client-side before it ever gets encrypted, so
// large photos don't bloat the ciphertext. WebP first, JPEG fallback.
async function compressImage(file, maxDim = 1600, quality = 0.82) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const webp = await new Promise((r) => canvas.toBlob(r, "image/webp", quality));
  if (webp && webp.size > 0) return webp;
  const jpeg = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
  return jpeg;
}
