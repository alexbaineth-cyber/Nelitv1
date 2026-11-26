import dns from 'dns/promises';
import net from 'net';

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  hostname?: string;
  port?: string;
  error?: string;
  requiresAllowlistApproval?: boolean;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata',
  'instance-data',
]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    num = (num << 8) | octet;
  }
  return num >>> 0;
}

function inCidr4(ipInt: number, baseIp: string, maskBits: number): boolean {
  const baseInt = ipv4ToInt(baseIp);
  if (baseInt === null) return false;
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

export function isPrivateOrReservedIp(rawIp: string): boolean {
  const ip = rawIp.trim().replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
  const ipVersion = net.isIP(ip);
  if (ipVersion === 0) return true;

  if (ipVersion === 4) {
    const ipInt = ipv4ToInt(ip);
    if (ipInt === null) return true;
    return (
      inCidr4(ipInt, '0.0.0.0', 8) ||       // "This" network
      inCidr4(ipInt, '10.0.0.0', 8) ||      // RFC1918 private
      inCidr4(ipInt, '100.64.0.0', 10) ||   // Carrier-grade NAT (RFC6598)
      inCidr4(ipInt, '127.0.0.0', 8) ||     // Loopback
      inCidr4(ipInt, '169.254.0.0', 16) ||  // Link-local / Cloud Metadata
      inCidr4(ipInt, '172.16.0.0', 12) ||   // RFC1918 private
      inCidr4(ipInt, '192.0.0.0', 24) ||    // IETF protocol assignments
      inCidr4(ipInt, '192.0.2.0', 24) ||    // TEST-NET-1
      inCidr4(ipInt, '192.88.99.0', 24) ||  // 6to4 relay anycast
      inCidr4(ipInt, '192.168.0.0', 16) ||  // RFC1918 private
      inCidr4(ipInt, '198.18.0.0', 15) ||   // Benchmarking
      inCidr4(ipInt, '198.51.100.0', 24) || // TEST-NET-2
      inCidr4(ipInt, '203.0.113.0', 24) ||  // TEST-NET-3
      inCidr4(ipInt, '224.0.0.0', 4) ||     // Multicast
      inCidr4(ipInt, '240.0.0.0', 4)        // Reserved / Broadcast
    );
  }

  // IPv6 checks
  if (ip === '::' || ip === '::1') return true;
  if (ip.startsWith('::ffff:')) {
    const embeddedV4 = ip.slice('::ffff:'.length);
    if (net.isIPv4(embeddedV4)) {
      return isPrivateOrReservedIp(embeddedV4);
    }
  }
  // Unique Local (fc00::/7), Link-local (fe80::/10), Multicast (ff00::/8)
  const firstHex = ip.split(':')[0] || '0';
  const firstWord = parseInt(firstHex, 16);
  if (Number.isNaN(firstWord)) return true;
  if ((firstWord & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((firstWord & 0xffc0) === 0xfe80) return true; // fe80::/10
  if ((firstWord & 0xff00) === 0xff00) return true; // ff00::/8
  return false;
}

export function isHostInAllowlist(hostname: string, allowlist: string[]): boolean {
  const cleanHost = hostname.trim().toLowerCase();
  if (!cleanHost || allowlist.length === 0) return false;
  return allowlist.some((pattern) => {
    const p = pattern.trim().toLowerCase();
    if (!p) return false;
    if (p.startsWith('*.')) {
      const suffix = p.slice(1); // ".example.com"
      return cleanHost.endsWith(suffix) || cleanHost === p.slice(2);
    }
    return cleanHost === p || cleanHost.endsWith('.' + p);
  });
}

export async function validateExternalStreamUrl(
  rawUrl: string,
  options: {
    allowlist?: string[];
    enforceAllowlist?: boolean;
  } = {}
): Promise<UrlValidationResult> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'Source URL inahitajika.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, error: 'Muundo wa Source URL si sahihi.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Itifaki zinazoruhusiwa ni HTTP na HTTPS pekee.' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URL zenye username/password haziruhusiwi kwa usalama.' };
  }

  const hostname = parsed.hostname.trim().toLowerCase();
  if (!hostname) {
    return { valid: false, error: 'Hostname haipo kwenye URL.' };
  }

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost')
  ) {
    return { valid: false, error: 'Anwani za ndani (localhost/internal) haziruhusiwi.' };
  }

  if (net.isIP(hostname) !== 0) {
    if (isPrivateOrReservedIp(hostname)) {
      return { valid: false, error: 'Anwani binafsi au za ndani (private IP) haziruhusiwi.' };
    }
  } else {
    try {
      const records = await dns.lookup(hostname, { all: true, verbatim: true });
      if (!records || records.length === 0) {
        return { valid: false, error: 'Hostname haiwezi kutatuliwa kwenye DNS.' };
      }
      for (const rec of records) {
        if (isPrivateOrReservedIp(rec.address)) {
          return { valid: false, error: 'Domain inaelekeza kwenye anwani ya ndani isiyoruhusiwa.' };
        }
      }
    } catch {
      return { valid: false, error: 'Imeshindikana kuthibitisha DNS ya domain hiyo.' };
    }
  }

  if (options.enforceAllowlist) {
    const list = options.allowlist || [];
    if (!isHostInAllowlist(hostname, list)) {
      return {
        valid: false,
        hostname,
        requiresAllowlistApproval: true,
        error: `Domain au IP "${hostname}" bado haijaidhinishwa kwenye Source Allowlist.`
      };
    }
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
    hostname,
    port: parsed.port || ''
  };
}

export interface SafeFetchOptions {
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  timeoutMs?: number;
  allowlist?: string[];
  enforceAllowlist?: boolean;
  sameOriginHostOnly?: string;
}

export async function safeFetchWithRedirectValidation(
  initialUrl: string,
  options: SafeFetchOptions = {}
): Promise<{ response: Response; finalUrl: string }> {
  const maxRedirects = 3;
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const check = await validateExternalStreamUrl(currentUrl, {
      allowlist: options.allowlist,
      enforceAllowlist: options.enforceAllowlist && hop === 0
    });
    if (!check.valid || !check.normalizedUrl) {
      throw new Error(check.error || 'Blocked URL destination');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
    let resp: Response;
    try {
      resp = await fetch(check.normalizedUrl, {
        method: options.method || 'GET',
        headers: options.headers,
        redirect: 'manual',
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get('location');
      if (!location) {
        throw new Error(`Redirect (${resp.status}) missing Location header`);
      }
      const nextUrl = new URL(location, check.normalizedUrl).toString();
      const nextParsed = new URL(nextUrl);
      const nextCheck = await validateExternalStreamUrl(nextUrl, {
        allowlist: options.allowlist,
        enforceAllowlist: false
      });
      if (!nextCheck.valid) {
        throw new Error(nextCheck.error || 'Redirect destination blocked by security policy');
      }
      if (
        options.enforceAllowlist &&
        options.allowlist &&
        options.sameOriginHostOnly &&
        nextParsed.hostname.toLowerCase() !== options.sameOriginHostOnly.toLowerCase() &&
        !isHostInAllowlist(nextParsed.hostname, options.allowlist)
      ) {
        // Allow CDN sub-redirects on trusted parent domain, block unrelated unlisted domain jumps
        const origParts = options.sameOriginHostOnly.toLowerCase().split('.').slice(-2).join('.');
        const nextParts = nextParsed.hostname.toLowerCase().split('.').slice(-2).join('.');
        if (origParts !== nextParts) {
          throw new Error('Redirect target outside authorized domain');
        }
      }
      currentUrl = nextUrl;
      continue;
    }

    return { response: resp, finalUrl: check.normalizedUrl };
  }

  throw new Error('Too many redirects');
}
