import crypto from 'crypto';
import { CookieOptions } from 'express';
import { envVars } from '../../config/env';
import { UserRole } from '../user/user.interface';

/**
 * Google OAuth "state" handling.
 *
 * The state parameter round-trips through Google and carries:
 *   - n:        a random nonce, also stored in an httpOnly cookie. The callback
 *               only proceeds when both match, which prevents login CSRF
 *               (an attacker cannot complete their own OAuth flow in a victim's
 *               browser).
 *   - role:     the role for a NEW account (seeker or employer only).
 *   - redirect: a frontend path to land on after login (relative paths only,
 *               so it can never become an open redirect).
 */

export const OAUTH_STATE_COOKIE = 'oauth_state';

export const SELF_REGISTRATION_ROLES: string[] = [
  UserRole.SEEKER,
  UserRole.EMPLOYER,
];

export interface IOAuthState {
  n: string;
  role: UserRole;
  redirect: string;
}

export const oauthStateCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: envVars.NODE_ENV === 'production',
  // The callback is a top-level GET navigation from Google, for which Lax
  // cookies are sent.
  sameSite: 'lax',
  maxAge: 10 * 60 * 1000,
  path: '/api/v1/auth/google',
});

/**
 * Accepts only same-site relative paths such as "/dashboard?tab=1".
 * Rejects absolute URLs, protocol-relative "//evil.com" and backslash tricks.
 */
export const sanitizeRedirectPath = (value: unknown): string => {
  if (typeof value !== 'string') return '/';
  const path = value.trim();
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\') ||
    path.length > 500
  ) {
    return '/';
  }
  return path;
};

export const createOAuthState = (query: {
  role?: unknown;
  redirect?: unknown;
}): { nonce: string; state: string } => {
  const nonce = crypto.randomBytes(16).toString('hex');
  const role =
    typeof query.role === 'string' &&
    SELF_REGISTRATION_ROLES.includes(query.role)
      ? (query.role as UserRole)
      : UserRole.SEEKER;

  const payload: IOAuthState = {
    n: nonce,
    role,
    redirect: sanitizeRedirectPath(query.redirect),
  };

  return {
    nonce,
    state: Buffer.from(JSON.stringify(payload)).toString('base64url'),
  };
};

export const parseOAuthState = (value: unknown): IOAuthState | null => {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (typeof parsed?.n !== 'string') return null;
    return {
      n: parsed.n,
      role: SELF_REGISTRATION_ROLES.includes(parsed.role)
        ? parsed.role
        : UserRole.SEEKER,
      redirect: sanitizeRedirectPath(parsed.redirect),
    };
  } catch {
    return null;
  }
};

export const isNonceMatch = (expected: unknown, actual: string): boolean => {
  if (typeof expected !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
