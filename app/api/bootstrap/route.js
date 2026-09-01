import { NextResponse } from "next/server";
import { ensureSchema } from "../../../lib/schema";

// Called once on app load (see app/layout.js). If any table is missing —
// fresh database, or one got dropped — it's recreated empty. Existing
// tables and rows are never touched.
export async function GET() {
  await ensureSchema();
  return NextResponse.json({ ok: true });
}
