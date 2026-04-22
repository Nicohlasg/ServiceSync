/**
 * Field-Level Encryption — ServiceSync
 *
 * AES-256-GCM encryption for sensitive PII fields (NRIC, PayNow keys).
 * Uses Node.js built-in crypto — no external KMS dependency.
 *
 * HIGH-07: Encrypts paynow_key (which may contain NRIC) at rest.
 *
 * Required env var:
 *   FIELD_ENCRYPTION_KEY — 32-byte hex string (64 hex chars)
 *                          Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;       // 96 bits — recommended for GCM
const AUTH_TAG_LENGTH = 16;  // 128 bits

// ---------------------------------------------------------------------------
// Key management
// ---------------------------------------------------------------------------

let _key: Buffer | null = null;

function getKey(): Buffer | null {
  if (_key) return _key;

  const hex = process.env.FIELD_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    // Key not configured — encryption disabled (graceful degradation)
    return null;
  }

  _key = Buffer.from(hex, 'hex');
  return _key;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encrypts a plaintext string. Returns `enc:<iv>:<authTag>:<ciphertext>` (all hex).
 * If encryption key is not configured, returns the plaintext unchanged
 * (allows gradual rollout without breaking existing data).
 */
export function encryptField(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `enc:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a value produced by `encryptField()`.
 * If the value doesn't start with `enc:`, returns it as-is
 * (supports mixed encrypted/plaintext during migration).
 */
export function decryptField(stored: string): string {
  if (!stored.startsWith('enc:')) {
    // Plaintext (pre-encryption or key not configured when written)
    return stored;
  }

  const key = getKey();
  if (!key) {
    // SEC-H3: Throw instead of returning ciphertext — callers must handle this.
    throw new Error('[crypto] FIELD_ENCRYPTION_KEY not set — cannot decrypt encrypted field');
  }

  const parts = stored.split(':');
  if (parts.length !== 4) {
    throw new Error('[crypto] Malformed encrypted field — expected enc:iv:tag:ciphertext format');
  }

  const [, ivHex, authTagHex, cipherHex] = parts;

  // SEC-H3: Throw on GCM auth failure instead of silently returning ciphertext.
  // Callers must handle the error — returning opaque enc:... strings would leak
  // encrypted material into UIs, logs, and API responses.
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
