import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "../../../lib/db";
import { ensureSchema } from "../../../lib/schema";

// GET /api/chats?accountId=...  -> chats that account belongs to
export async function GET(req) {
  await ensureSchema();
  const accountId = new URL(req.url).searchParams.get("accountId");
  if (!accountId) {
    return NextResponse.json({ error: "accountId query param required" }, { status: 400 });
  }

  const db = getDb();
  const res = await db.execute({
    sql: `SELECT c.id, c.name, c.lock_type, c.kdf_salt, m.wrapped_chat_key
          FROM chats c
          JOIN chat_members m ON m.chat_id = c.id
          WHERE m.account_id = ?
          ORDER BY c.created_at DESC`,
    args: [accountId],
  });
  return NextResponse.json({ chats: res.rows });
}

// POST /api/chats  { name, lockType, kdfSalt, creatorAccountId, wrappedChatKey }
// The chat key is generated and wrapped client-side; the server only ever
// stores ciphertext.
export async function POST(req) {
  await ensureSchema();
  const { name, lockType, kdfSalt, creatorAccountId, wrappedChatKey } = await req.json();

  if (!name || !lockType || !kdfSalt || !creatorAccountId || !wrappedChatKey) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (!["manual", "cached"].includes(lockType)) {
    return NextResponse.json({ error: "invalid lockType" }, { status: 400 });
  }

  const db = getDb();
  const chatId = uuid();
  const now = Date.now();

  await db.execute({
    sql: "INSERT INTO chats (id, name, lock_type, kdf_salt, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [chatId, name, lockType, kdfSalt, now],
  });
  await db.execute({
    sql: `INSERT INTO chat_members (chat_id, account_id, wrapped_chat_key, joined_at)
          VALUES (?, ?, ?, ?)`,
    args: [chatId, creatorAccountId, JSON.stringify(wrappedChatKey), now],
  });

  return NextResponse.json({ chat: { id: chatId, name, lock_type: lockType, kdf_salt: kdfSalt } });
}
