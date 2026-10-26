import { CookieOptions, Response } from 'express';
import { envVars } from '../config/env';

export interface AuthTokens {
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Shared cookie attributes. In production the frontend and API usually live
 * on different sites (e.g. two *.vercel.app projects), so cookies must be
 * SameSite=None; Secure to be sent on cross-site fetches. The same attributes
 * must be used when clearing, otherwise browsers may keep the cookie.
 */
export const authCookieOptions = (): CookieOptions => {
  const isProduction = envVars.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  };
};

export const setAuthCookie = (res: Response, tokenInfo: AuthTokens) => {
  if (tokenInfo.accessToken) {
    res.cookie('accessToken', tokenInfo.accessToken, authCookieOptions());
  }

  if (tokenInfo.refreshToken) {
    res.cookie('refreshToken', tokenInfo.refreshToken, authCookieOptions());
  }
};

export const clearAuthCookies = (res: Response) => {
  res.clearCookie('accessToken', authCookieOptions());
  res.clearCookie('refreshToken', authCookieOptions());
};
