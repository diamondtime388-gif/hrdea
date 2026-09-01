"use client";

import { useEffect, useState } from "react";
import UnlockScreen from "../components/UnlockScreen";
import AccountSwitcher from "../components/AccountSwitcher";
import ChatList from "../components/ChatList";
import ChatView from "../components/ChatView";
import { newSalt, deriveKey, randomChatKey, wrapChatKey } from "../lib/crypto";
import { forgetAllKeys } from "../lib/keystore";

export default function Home() {
  const [identity, setIdentity] = useState(null); // { masterSecret, keypair, publicKeyB64 }
  const [accounts, setAccounts] = useState([]);
  const [currentAccountId, setCurrentAccountId] = useState(null);
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [view, setView] = useState("list"); // "list" | "chat", drives the mobile-portrait swap

  // Recreate any missing DB tables on first load — never touches existing data.
  useEffect(() => {
    fetch("/api/bootstrap").catch(() => {});
  }, []);

  useEffect(() => {
    if (!identity) return;
    fetch("/api/accounts")
      .then((r) => r.json())
      .then(({ accounts }) => {
        setAccounts(accounts);
        if (accounts.length > 0) setCurrentAccountId(accounts[0].id);
      });
  }, [identity]);

  useEffect(() => {
    if (!currentAccountId) return;
    fetch(`/api/chats?accountId=${currentAccountId}`)
      .then((r) => r.json())
      .then(({ chats }) => setChats(chats));
  }, [currentAccountId]);

  async function createAccount(displayName) {
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, publicKey: identity.publicKeyB64 }),
    });
    const { account } = await res.json();
    setAccounts((prev) => [...prev, account]);
    setCurrentAccountId(account.id);
  }

  async function createChat({ name, lockType, password }) {
    const salt = await newSalt();
    const memberKey = await deriveKey(password, salt);
    const chatKey = await randomChatKey();
    const wrapped = await wrapChatKey(memberKey, chatKey);

    const res = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        lockType,
        kdfSalt: salt,
        creatorAccountId: currentAccountId,
        wrappedChatKey: wrapped,
      }),
    });
    const { chat } = await res.json();
    setChats((prev) => [
      { ...chat, wrapped_chat_key: JSON.stringify(wrapped) },
      ...prev,
    ]);
  }

  function signOut() {
    setIdentity(null);
    setAccounts([]);
    setCurrentAccountId(null);
    setChats([]);
    setCurrentChatId(null);
    forgetAllKeys();
  }

  if (!identity) {
    return <UnlockScreen onUnlock={setIdentity} />;
  }

  const currentChat = chats.find((c) => c.id === currentChatId);
  const currentAccount = accounts.find((a) => a.id === currentAccountId);

  return (
    <div className="app-shell" data-view={view}>
      <div style={{ gridColumn: "1 / -1", borderBottom: "1px solid var(--border)" }} />
      <div className="list-pane" style={{ display: "flex", flexDirection: "column" }}>
        {currentAccount && (
          <AccountSwitcher
            accounts={accounts}
            currentId={currentAccountId}
            onSwitch={setCurrentAccountId}
            onCreate={createAccount}
          />
        )}
        <ChatList
          chats={chats}
          currentChatId={currentChatId}
          onSelect={(id) => {
            setCurrentChatId(id);
            setView("chat");
          }}
          onCreate={createChat}
        />
        <button
          onClick={signOut}
          style={{
            margin: 12,
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--text-dim)",
            padding: "8px 10px",
            fontSize: 13,
          }}
        >
          Lock vault
        </button>
      </div>

      {currentChat && currentAccount ? (
        <ChatView chat={currentChat} account={currentAccount} onBack={() => setView("list")} />
      ) : (
        <div
          className="chat-pane"
          style={{
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-dim)",
            fontSize: 14,
          }}
        >
          Select a chat to start reading.
        </div>
      )}
    </div>
  );
}
