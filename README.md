# Cipher Thread — main site

Next.js 14 (App Router) + Turso (libSQL) + client-side double encryption
(AES-256-GCM wrapped in XChaCha20-Poly1305, keys derived with Argon2id).
The server only ever stores ciphertext — it cannot read messages, and
never sees a password or key file.

## 1. Create the database

Easiest path — via Vercel, since that's where this deploys:

1. Go to your Vercel project → **Storage** → **Marketplace Database Providers** → **Turso**.
2. Create a database. Vercel will inject `TURSO_DATABASE_URL` and
   `TURSO_AUTH_TOKEN` into your project automatically.

Local/manual path — via the Turso CLI:

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
turso db create cipher-thread
turso db show cipher-thread --url
turso db tokens create cipher-thread
```

Copy `.env.example` to `.env.local` and fill in the two values.

## 2. Install and run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. On first load the app calls `/api/bootstrap`,
which creates any missing tables (fine on an empty database — see
`lib/schema.js`).

## 3. Try it out

1. **Create a new vault** — this generates and downloads a key file
   (`cipher-thread-key-*.json`). Keep it safe; there's no password reset.
2. Open the side menu, **create an account** (name only, no avatar).
3. Create a chat, set a chat password, choose whether it should ask for
   the password every time ("manual") or remember it on this device
   ("cached", stored in IndexedDB, never sent to the server).
4. Send text and image messages. Reload the page, load the same key
   file, and re-enter the chat password to confirm decryption round-trips.
5. To test the "missing table" recovery: open the Turso shell
   (`turso db shell cipher-thread`) and run `DROP TABLE messages;`, then
   reload the site — it's recreated automatically, empty.

## 4. Deploy

```bash
npm i -g vercel
vercel
```

Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` as environment variables
in the Vercel project settings if they weren't injected automatically.

## Project layout

```
app/
  page.js                 unlock screen + account/chat shell (client)
  layout.js
  globals.css              phone-portrait / phone-landscape / desktop layouts
  api/
    bootstrap/route.js     recreate any missing tables (self-healing schema)
    accounts/route.js      list/create accounts
    chats/route.js         list/create chats (server only sees wrapped keys)
    messages/route.js      list/send messages (server only sees ciphertext)
components/
  UnlockScreen.jsx
  AccountSwitcher.jsx
  ChatList.jsx
  ChatView.jsx
lib/
  db.js                    Turso client
  schema.js                self-healing schema + wipeAllData()
  crypto.js                Argon2id, X25519 key file, double-layer AEAD
  keystore.js               IndexedDB cache for "remembered" chat keys
```

## Notes on the crypto, honestly

- **Two independent primitives** (AES-256-GCM via WebCrypto, XChaCha20-Poly1305
  via libsodium) so a break in one algorithm alone doesn't expose plaintext.
- **Argon2id** with a high memory cost is what actually makes offline
  brute-forcing of a password expensive — this matters more than the
  number of encryption layers.
- The account's `public_key`/X25519 keypair is generated and stored as
  the foundation for real multi-device key exchange, but the current
  chat-key wrapping uses the chat password directly. Wiring `chat_members`
  to wrap each member's copy of the chat key under their X25519 public
  key (instead of a shared password) is the natural next step if you
  want per-device revocation without changing the chat password.
