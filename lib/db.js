import { createClient } from "@libsql/client";

let client;

/**
 * Single shared Turso connection. Reused across API route invocations
 * within the same serverless instance.
 */
export function getDb() {
  if (!client) {
    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
      throw new Error(
        "Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN. Copy .env.example to .env.local and fill them in."
      );
    }
    client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}
