/**
 * NeliTv API Client Authentication Configuration
 */

export const NELI_CLIENT_API_KEY = 'neli_sec_9971ab4f7831d8e0e5c9429b9f71c';

/**
 * Returns authentication headers required for protected NeliTv API endpoints
 */
export function getAppAuthHeaders(): Record<string, string> {
  return {
    'Accept': 'application/json',
    'X-Neli-Client': 'nelitv-web',
    'X-Neli-Api-Key': NELI_CLIENT_API_KEY,
    'Authorization': `Bearer ${NELI_CLIENT_API_KEY}`
  };
}
