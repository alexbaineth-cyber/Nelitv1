import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Secret keys for signing and validating internal app & player requests
export const NELI_JWT_SECRET = process.env.NELITV_JWT_SECRET || 'nelitv_jwt_secret_99f82d8c3b7a1e05f6';
export const NELI_API_KEY = process.env.NELITV_API_KEY || 'neli_sec_9971ab4f7831d8e0e5c9429b9f71c';

/**
 * Generates an HMAC-SHA256 JWT for app client or player sessions
 */
export function signClientToken(payload: Record<string, any> = {}, expiresInSeconds: number = 86400): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSeconds;
  const fullPayload = { client: 'nelitv-web', ...payload, exp, iat: now, iss: 'nelitv-auth' };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', NELI_JWT_SECRET).update(data).digest('base64url');

  return `${data}.${signature}`;
}

/**
 * Validates HMAC-SHA256 JWT
 */
export function verifyClientToken(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSig = crypto.createHmac('sha256', NELI_JWT_SECRET).update(data).digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Strictly locks down internal raw channel/token endpoints.
 * Blocks direct browser URL visits and unauthenticated external requests so raw streams
 * are NEVER accessible outside the NeliTv Player & official Content/Player API.
 */
export function requireChannelAuth(req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

  const isDirectBrowserVisit =
    req.get('sec-fetch-mode') === 'navigate' ||
    req.get('sec-fetch-dest') === 'document' ||
    Boolean(req.headers.accept && req.headers.accept.includes('text/html'));

  if (isDirectBrowserVisit) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Raw streams are not accessible outside NeliTv Player & API.',
      contentApi: 'https://nelitv.online/api/v1/content',
      playerApi: 'https://nelitv.online/api/v1/player/azam-sports-1-hd'
    });
  }

  const authHeader = req.get('Authorization') || req.get('authorization');
  const apiKey =
    req.get('X-Neli-Api-Key') ||
    req.get('x-neli-api-key') ||
    req.get('x-api-key') ||
    req.get('X-API-Key') ||
    (req.query.api_key as string);
  const clientHeader = req.get('X-Neli-Client');
  const secFetchSite = req.get('sec-fetch-site');
  const referer = req.get('referer') || req.get('origin') || '';

  let isAuthenticated = false;

  // 1. Internal client API Key validation
  if (apiKey && apiKey === NELI_API_KEY) {
    isAuthenticated = true;
  }

  // 2. Bearer JWT or internal key validation
  if (!isAuthenticated && authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token === NELI_API_KEY) {
      isAuthenticated = true;
    } else {
      const decoded = verifyClientToken(token);
      if (decoded && decoded.client === 'nelitv-web') {
        isAuthenticated = true;
      }
    }
  }

  // 3. Same-origin internal NeliTv Player XHR verification
  if (
    !isAuthenticated &&
    clientHeader === 'nelitv-web' &&
    (secFetchSite === 'same-origin' ||
      referer.includes('nelitv.online') ||
      referer.includes('.run.app') ||
      referer.includes('localhost'))
  ) {
    isAuthenticated = true;
  }

  if (isAuthenticated) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'Forbidden: Raw stream data is strictly restricted to NeliTv internal player. Use Content API & Player API.',
    contentApi: 'https://nelitv.online/api/v1/content',
    playerApi: 'https://nelitv.online/api/v1/player/azam-sports-1-hd',
    portal: 'https://nelitv.online/api'
  });
}
