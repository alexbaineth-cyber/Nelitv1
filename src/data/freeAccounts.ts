/**
 * NeliTv Free Accounts Configuration
 * 
 * 10 Pre-configured Free VIP Accounts:
 * Usernames: user1 to user10
 * Emails: user1@login.com to user10@login.com
 * Password: Free123
 * Status: Active VIP Lifetime Subscription
 */

export interface FreeAccount {
  email: string;
  username: string;
  password: string;
  displayName: string;
  planName: string;
  expiresAt: string;
}

export const FREE_PASSWORD_DEFAULT = 'Free123';
export const FREE_EXPIRATION_LIFETIME = '2099-12-31T23:59:59.000Z';
export const FREE_PLAN_NAME = 'Kifurushi cha Bure (Free VIP)';

export const FREE_ACCOUNTS: FreeAccount[] = Array.from({ length: 10 }, (_, i) => {
  const num = i + 1;
  return {
    email: `user${num}@login.com`,
    username: `user${num}`,
    password: FREE_PASSWORD_DEFAULT,
    displayName: `VIP User ${num}`,
    planName: FREE_PLAN_NAME,
    expiresAt: FREE_EXPIRATION_LIFETIME
  };
});

/**
 * Checks if an email corresponds to one of the 10 free accounts
 */
export function isFreeAccountEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return FREE_ACCOUNTS.some(
    acc => acc.email.toLowerCase() === clean || acc.username.toLowerCase() === clean
  );
}

/**
 * Validates free account credentials (email or username + password)
 */
export function verifyFreeAccount(emailOrUsername?: string | null, password?: string | null): FreeAccount | null {
  if (!emailOrUsername || !password) return null;
  const cleanInput = emailOrUsername.trim().toLowerCase();
  const cleanPass = password.trim();

  const matched = FREE_ACCOUNTS.find(acc => {
    const isEmailMatch = acc.email.toLowerCase() === cleanInput;
    const isUserMatch = acc.username.toLowerCase() === cleanInput;
    return (isEmailMatch || isUserMatch) && cleanPass === acc.password;
  });

  return matched || null;
}
