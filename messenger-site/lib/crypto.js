"use client";

import _sodium from "libsodium-wrappers-sumo";

let sodium;
async function ready() {
  if (!sodium) {
    await _sodium.ready;
    sodium = _sodium;
  }
  return sodium;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(bytes) {
  return sodium.to_base64(bytes, sodium.base64_variants.URLSAFE_NO_PADDING);
}
function fromB64(str) {
  return sodium.from_base64(str, sodium.base64_variants.URLSAFE_NO_PADDING);
}

/* ---------------------------------------------------------------- *
 *  Site-wide key file                                               *
 *  A key file is a random 32-byte master secret plus an X25519       *
 *  keypair derived from it. Losing the file = losing access; there   *
 *  is no server-side recovery by design.                             *
 * ---------------------------------------------------------------- */

export async function generateKeyFile() {
  const s = await ready();
  const masterSecret = s.randombytes_buf(32);
  const seed = s.crypto_generichash(32, masterSecret, enc.encode("x25519-seed"));
  const keypair = s.crypto_box_seed_keypair(seed);
  const payload = {
    v: 1,
    createdAt: Date.now(),
    masterSecret: b64(masterSecret),
    publicKey: b64(keypair.publicKey),
  };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  return { blob, publicKey: b64(keypair.publicKey) };
}

export async function loadKeyFile(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  const s = await ready();
  const masterSecret = fromB64(payload.masterSecret);
  const seed = s.crypto_generichash(32, masterSecret, enc.encode("x25519-seed"));
  const keypair = s.crypto_box_seed_keypair(seed);
  return { masterSecret, keypair, publicKeyB64: b64(keypair.publicKey) };
}

/* ---------------------------------------------------------------- *
 *  Argon2id KDF — turns a chat password (or the master secret) into  *
 *  a 32-byte symmetric key. High memory cost on purpose: it's the    *
 *  main thing standing between an attacker and offline brute force.  *
 * ---------------------------------------------------------------- */

export async function newSalt() {
  const s = await ready();
  return b64(s.randombytes_buf(s.crypto_pwhash_SALTBYTES));
}

export async function deriveKey(secretBytesOrString, saltB64) {
  const s = await ready();
  const secret =
    typeof secretBytesOrString === "string"
      ? enc.encode(secretBytesOrString)
      : secretBytesOrString;
  const salt = fromB64(saltB64);
  return s.crypto_pwhash(
    32,
    secret,
    salt,
    s.crypto_pwhash_OPSLIMIT_SENSITIVE,
    s.crypto_pwhash_MEMLIMIT_MODERATE, // MODERATE keeps low-end phones usable; bump to SENSITIVE for desktop-only deployments
    s.crypto_pwhash_ALG_ARGON2ID13
  );
}

/* ---------------------------------------------------------------- *
 *  Double-layer AEAD: AES-256-GCM (WebCrypto, layer 1) wrapped in    *
 *  XChaCha20-Poly1305 (libsodium, layer 2). Two independent          *
 *  primitives from two different implementations — breaking one      *
 *  algorithm alone does not expose the plaintext.                    *
 * ---------------------------------------------------------------- */

async function aesGcmEncrypt(keyBytes, plaintextBytes) {
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintextBytes);
  return { iv, ciphertext: new Uint8Array(ct) };
}

async function aesGcmDecrypt(keyBytes, iv, ciphertextBytes) {
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertextBytes);
  return new Uint8Array(pt);
}

/**
 * encryptDouble(key32, plaintext: Uint8Array | string)
 * Returns { ciphertext, outerNonce, innerNonce } all base64, ready to store.
 */
export async function encryptDouble(key32, plaintext) {
  const s = await ready();
  const plainBytes = typeof plaintext === "string" ? enc.encode(plaintext) : plaintext;

  // derive two independent subkeys from the one chat key so a single
  // leaked key can't be reused across layers
  const aesKey = s.crypto_generichash(32, key32, enc.encode("layer-aes"));
  const xchachaKey = s.crypto_generichash(32, key32, enc.encode("layer-xchacha"));

  const { iv, ciphertext: layer1 } = await aesGcmEncrypt(aesKey, plainBytes);

  const innerNonce = s.randombytes_buf(s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const layer2 = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    layer1,
    null,
    null,
    innerNonce,
    xchachaKey
  );

  return {
    ciphertext: b64(layer2),
    outerNonce: b64(iv),
    innerNonce: b64(innerNonce),
  };
}

export async function decryptDouble(key32, { ciphertext, outerNonce, innerNonce }) {
  const s = await ready();
  const aesKey = s.crypto_generichash(32, key32, enc.encode("layer-aes"));
  const xchachaKey = s.crypto_generichash(32, key32, enc.encode("layer-xchacha"));

  const layer2 = fromB64(ciphertext);
  const layer1 = s.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    layer2,
    null,
    fromB64(innerNonce),
    xchachaKey
  );

  const plainBytes = await aesGcmDecrypt(aesKey, fromB64(outerNonce), layer1);
  return plainBytes;
}

export async function decryptDoubleToString(key32, envelope) {
  const bytes = await decryptDouble(key32, envelope);
  return dec.decode(bytes);
}

/* ---------------------------------------------------------------- *
 *  Wrap a chat key under a member's derived key, so the server only  *
 *  ever stores per-member wrapped keys, never the raw chat key.      *
 * ---------------------------------------------------------------- */

export async function wrapChatKey(memberKey32, chatKey32) {
  return encryptDouble(memberKey32, chatKey32);
}

export async function unwrapChatKey(memberKey32, envelope) {
  return decryptDouble(memberKey32, envelope);
}

export async function randomChatKey() {
  const s = await ready();
  return s.randombytes_buf(32);
}

export { b64, fromB64, ready as sodiumReady };
