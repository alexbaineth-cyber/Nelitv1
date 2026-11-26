import crypto from 'crypto';
import { NELI_JWT_SECRET } from './authMiddleware.ts';

function getRelayEncryptionKey(): Buffer {
  const material = process.env.STREAM_RELAY_SECRET || `${NELI_JWT_SECRET}|nelitv-hls-relay-v1`;
  return crypto.createHash('sha256').update(material).digest();
}

export function generateUnpredictableStreamId(): string {
  // 11 chars URL-safe unpredictable ID (64+ bits entropy)
  return crypto.randomBytes(8).toString('base64url').replace(/[-_]/g, (m) => (m === '-' ? 'x' : 'k'));
}

export function generatePlaybackToken(): string {
  return crypto.randomBytes(18).toString('base64url');
}

export function verifyPlaybackTokenConstantTime(expected: string, provided: string): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function encryptRelayTarget(streamId: string, targetUrl: string, expiresAtMs: number): string {
  const key = getRelayEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(streamId, 'utf8'));

  const payload = JSON.stringify({ u: targetUrl, e: expiresAtMs });
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64url')}.${encrypted.toString('base64url')}.${tag.toString('base64url')}`;
}

export function decryptRelayTarget(
  streamId: string,
  token: string
): { url: string; expiresAtMs: number } | null {
  try {
    const cleanToken = token.replace(/\.[a-z0-9]+$/i, '');
    const parts = cleanToken.split('.');
    if (parts.length !== 3) return null;

    const [ivB64, dataB64, tagB64] = parts;
    const iv = Buffer.from(ivB64, 'base64url');
    const data = Buffer.from(dataB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    if (iv.length !== 12 || tag.length !== 16) return null;

    const key = getRelayEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(streamId, 'utf8'));
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(decrypted);
    if (!parsed?.u || typeof parsed.u !== 'string' || typeof parsed.e !== 'number') {
      return null;
    }
    if (parsed.e <= Date.now()) {
      return null;
    }
    return { url: parsed.u, expiresAtMs: parsed.e };
  } catch {
    return null;
  }
}

export function maskHostForDisplay(hostname: string): string {
  const clean = hostname.trim();
  if (!clean) return '••••';
  const parts = clean.split('.');
  if (parts.length >= 2) {
    return `${parts[0].slice(0, 2)}•••.${parts[parts.length - 1]}`;
  }
  return `${clean.slice(0, 2)}••••`;
}

export function maskSourceUrlForDisplay(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const ext = u.pathname.endsWith('.m3u8') ? '.m3u8' : '';
    return `origin://${maskHostForDisplay(u.hostname)}/••••${ext}`;
  } catch {
    return 'origin://••••';
  }
}
