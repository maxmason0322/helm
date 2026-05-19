import { createHash, timingSafeEqual } from 'crypto';
import { importJWK, jwtVerify, errors as joseErrors } from 'jose';
import { plaidClient } from './plaid.service.js';

// Cache JWKs by kid with max 20 entries (LRU eviction)
const MAX_CACHE_SIZE = 20;
const keyCache = new Map<string, CryptoKey>();

function cacheSet(kid: string, key: CryptoKey) {
  if (keyCache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entry
    const firstKey = keyCache.keys().next().value;
    if (firstKey) keyCache.delete(firstKey);
  }
  keyCache.set(kid, key);
}

function decodeJwtHeader(token: string): { alg: string; kid: string } {
  const [headerB64] = token.split('.');
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
  return header;
}

async function fetchKey(kid: string): Promise<CryptoKey> {
  const response = await plaidClient.webhookVerificationKeyGet({ key_id: kid });
  const key = (await importJWK(response.data.key, 'ES256')) as CryptoKey;
  cacheSet(kid, key);
  return key;
}

export async function verifyPlaidWebhook(rawBody: Buffer, plaidVerification: string): Promise<boolean> {
  // 1. Decode JWT header
  const header = decodeJwtHeader(plaidVerification);

  // 2. Reject if not ES256
  if (header.alg !== 'ES256') {
    throw new Error(`Unsupported webhook signature algorithm: ${header.alg}`);
  }

  // 3. Get public key (cached or fetch)
  let key = keyCache.get(header.kid) || await fetchKey(header.kid);

  // 4. Verify JWT signature + check iat is within 5 minutes
  let payload: { request_body_sha256?: string };
  try {
    const result = await jwtVerify(plaidVerification, key, {
      maxTokenAge: '5 min',
    });
    payload = result.payload as typeof payload;
  } catch (err) {
    // Retry only on signature verification failure (key may have rotated)
    if (err instanceof joseErrors.JWSSignatureVerificationFailed) {
      keyCache.delete(header.kid);
      key = await fetchKey(header.kid);
      const result = await jwtVerify(plaidVerification, key, {
        maxTokenAge: '5 min',
      });
      payload = result.payload as typeof payload;
    } else {
      throw err;
    }
  }

  // 5-6. Verify body hash with constant-time comparison
  if (!payload.request_body_sha256) {
    throw new Error('Missing request_body_sha256 in webhook JWT');
  }

  const bodyHash = createHash('sha256').update(rawBody).digest('hex');
  const expectedHash = Buffer.from(payload.request_body_sha256, 'hex');
  const actualHash = Buffer.from(bodyHash, 'hex');

  if (expectedHash.length !== actualHash.length) return false;
  return timingSafeEqual(expectedHash, actualHash);
}
