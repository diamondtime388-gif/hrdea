import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "../../../lib/db";
import { ensureSchema } from "../../../lib/schema";

export async function GET() {
  await ensureSchema();
  const db = getDb();
  const res = await db.execute(
    "SELECT id, display_name, public_key, created_at FROM accounts ORDER BY created_at ASC"
  );
  return NextResponse.json({ accounts: res.rows });
}

export async function POST(req) {
  await ensureSchema();
  const { displayName, publicKey } = await req.json();

  if (!displayName || !publicKey) {
    return NextResponse.json({ error: "displayName and publicKey are required" }, { status: 400 });
  }
  if (displayName.length > 64) {
    return NextResponse.json({ error: "displayName too long" }, { status: 400 });
  }

  const db = getDb();
  const id = uuid();
  await db.execute({
    sql: "INSERT INTO accounts (id, display_name, public_key, created_at) VALUES (?, ?, ?, ?)",
    args: [id, displayName, publicKey, Date.now()],
  });

  return NextResponse.json({ account: { id, display_name: displayName, public_key: publicKey } });
}
