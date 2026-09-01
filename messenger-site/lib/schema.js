import { getDb } from "./db";

// Every statement is IF NOT EXISTS: safe to run on every cold start.
// If a table is missing (fresh DB, or one got dropped) it is recreated
// empty. Existing tables and their rows are left untouched.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    public_key TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    lock_type TEXT NOT NULL CHECK (lock_type IN ('manual','cached')),
    kdf_salt TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS chat_members (
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    wrapped_chat_key TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (chat_id, account_id)
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    msg_type TEXT NOT NULL CHECK (msg_type IN ('text','image')),
    ciphertext TEXT NOT NULL,
    outer_nonce TEXT NOT NULL,
    inner_nonce TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_members_account ON chat_members(account_id)`,
];

let bootstrapped = false;

export async function ensureSchema() {
  if (bootstrapped) return; // once per warm instance is enough
  const db = getDb();
  for (const sql of STATEMENTS) {
    await db.execute(sql);
  }
  bootstrapped = true;
}

/** Wipe every row from every table. Used by the admin panel's instant-wipe button. */
export async function wipeAllData() {
  const db = getDb();
  await db.execute("DELETE FROM messages");
  await db.execute("DELETE FROM chat_members");
  await db.execute("DELETE FROM chats");
  await db.execute("DELETE FROM accounts");
}
