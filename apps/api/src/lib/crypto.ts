import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';

/** URL-safe random token (256 bits by default). */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

/** Tokens are stored only as SHA-256 hashes: a DB leak does not expose usable tokens. */
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const hmacSha256 = (secret: string, payload: string | Buffer) =>
  createHmac('sha256', secret).update(payload).digest('hex');

/** Guest access token for an order: derived from the id, so retries return the same token. */
export const orderAccessToken = (secret: string, orderId: string) =>
  createHmac('sha256', secret).update(`order-access:${orderId}`).digest('base64url');

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// OWASP-recommended Argon2id parameters.
const ARGON_OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string) => argon2.hash(password, ARGON_OPTS);

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/** Used to equalise timing when the user does not exist. */
let dummyHash: Promise<string> | null = null;
export async function fakeVerify(password: string) {
  dummyHash ??= hashPassword('dummy-password-for-timing');
  await verifyPassword(await dummyHash, password);
}
