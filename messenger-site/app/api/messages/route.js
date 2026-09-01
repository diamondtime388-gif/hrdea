import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "../../../lib/db";
import { ensureSchema } from "../../../lib/schema";

// GET /api/messages?chatId=...
export async function GET(req) {
  await ensureSchema();
  const chatId = new URL(req.url).searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ error: "chatId query param required" }, { status: 400 });
  }

  const db = getDb();
  const res = await db.execute({
    sql: `SELECT id, sender_id, msg_type, ciphertext, outer_nonce, inner_nonce, created_at
          FROM messages WHERE chat_id = ? ORDER BY created_at ASC`,
    args: [chatId],
  });
  return NextResponse.json({ messages: res.rows });
}

// POST /api/messages  { chatId, senderId, msgType, ciphertext, outerNonce, innerNonce }
// Body is already double-encrypted client-side. The server cannot read it.
export async function POST(req) {
  await ensureSchema();
  const { chatId, senderId, msgType, ciphertext, outerNonce, innerNonce } = await req.json();

  if (!chatId || !senderId || !msgType || !ciphertext || !outerNonce || !innerNonce) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (!["text", "image"].includes(msgType)) {
    return NextResponse.json({ error: "invalid msgType" }, { status: 400 });
  }

  const db = getDb();
  const id = uuid();
  const createdAt = Date.now();

  await db.execute({
    sql: `INSERT INTO messages (id, chat_id, sender_id, msg_type, ciphertext, outer_nonce, inner_nonce, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, chatId, senderId, msgType, ciphertext, outerNonce, innerNonce, createdAt],
  });

  return NextResponse.json({ message: { id, chatId, senderId, msgType, createdAt } });
}
