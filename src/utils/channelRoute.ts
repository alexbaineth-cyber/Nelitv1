import { Channel } from '../data/channels.ts';

/**
 * Returns a clean, user-friendly and shareable slug for a channel.
 * Example:
 * - "Azam One" -> "azam-one"
 * - "Azam Sports 1 HD" -> "azam-sports-1-hd"
 * - "Baynith Sports 1" -> "baynith-sports-1"
 * - "Sinema Zetu" -> "sinema-zetu"
 */
export function getChannelRouteSlug(channel: Channel): string {
  if (!channel) return '';
  
  // If the id itself is already a clean semantic identifier (like 'baynith-sports-1')
  if (channel.id && /^[a-z0-9]+(-[a-z0-9]+)+$/i.test(channel.id) && channel.id.length < 30) {
    return channel.id.toLowerCase();
  }

  // Generate clean slug from channel name
  const nameSlug = channel.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return nameSlug || channel.id;
}

/**
 * Returns the full shareable URL for a channel.
 * Example: "https://nelitv.online/azam-one"
 */
export function getChannelShareUrl(channel: Channel): string {
  const origin = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'https://nelitv.online';
  const slug = getChannelRouteSlug(channel);
  return `${origin}/${slug}`;
}

/**
 * Resolves a channel from a URL path, query param, or channel number/ID.
 * Handles:
 * - Clean slugs: "azam-one", "azam-sports-1-hd", "baynith-sports-1"
 * - Exact IDs: "R17JUvbCEzu2eTbjnE74", "c405ae74-c4c5-4842-9f26-130ce380b307"
 * - Channel numbers: "1", "2", "5"
 * - URL paths: "/azam-one", "/channel/5", "/watch/azam-one"
 */
export function findChannelFromRoute(rawPathOrQuery: string, channels: Channel[]): Channel | undefined {
  if (!rawPathOrQuery || !Array.isArray(channels) || channels.length === 0) {
    return undefined;
  }

  let clean = decodeURIComponent(rawPathOrQuery).trim().toLowerCase();
  // Strip leading/trailing slashes and common prefixes
  clean = clean.replace(/^\/+|\/+$/g, '');
  if (clean.startsWith('channel/')) clean = clean.slice('channel/'.length);
  if (clean.startsWith('watch/')) clean = clean.slice('watch/'.length);

  // Exclude static reserved app routes
  const reserved = ['download', 'apk', 'privacy', 'terms', 'api', 'login', 'account', 'premium', 'search', 'verify', 'baynithalex'];
  if (reserved.includes(clean)) {
    return undefined;
  }

  // 1. Match by channel ID exact (case-insensitive)
  const byId = channels.find(c => c.id.toLowerCase() === clean);
  if (byId) return byId;

  // 2. Match by clean slug
  const bySlug = channels.find(c => getChannelRouteSlug(c).toLowerCase() === clean);
  if (bySlug) return bySlug;

  // 3. Match by channel number / order (e.g. "1", "2", "5")
  if (/^\d+$/.test(clean)) {
    const num = parseInt(clean, 10);
    // Try exact order match
    const byOrder = channels.find(c => c.order === num);
    if (byOrder) return byOrder;
    // Try 1-based index match
    if (num >= 1 && num <= channels.length) {
      return channels[num - 1];
    }
  }

  // 4. Normalized alphanumeric match (e.g. "azamone" matches "Azam One")
  const stripped = clean.replace(/[^a-z0-9]/g, '');
  if (stripped.length >= 2) {
    const byAlnum = channels.find(c => {
      const cStripped = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cStripped === stripped;
    });
    if (byAlnum) return byAlnum;
  }

  return undefined;
}
