/**
 * @file env.ts
 * @description Environment variable configuration and validation
 * This file loads, validates, and exports all environment variables.
 * The process fails fast (throws on import) when a required value is missing
 * or malformed, so misconfiguration surfaces at boot instead of mid-request.
 */

import dotenv from 'dotenv';

// Loads a local .env file when present. On Vercel there is no .env file —
// variables come from the project settings and dotenv is a no-op.
dotenv.config();

interface EnvConfig {
  PORT: string;
  NODE_ENV: 'development' | 'production' | 'test';

  DB_URL: string;

  FRONTEND_URL: string; // primary frontend origin (CORS + OAuth redirects)
  CORS_ORIGINS: string[]; // FRONTEND_URL plus any extra allowed origins

  BCRYPT_SALT_ROUND: number;

  JWT_ACCESS_SECRET: string; // Secret key for signing access tokens
  JWT_ACCESS_EXPIRES: string; // Expiration time for access tokens
  JWT_REFRESH_SECRET: string; // Secret key for signing refresh tokens
  JWT_REFRESH_EXPIRES: string; // Expiration time for refresh tokens

  SUPER_ADMIN_EMAIL: string;
  SUPER_ADMIN_PASSWORD: string;

  // Google OAuth is optional — the /auth/google routes return 503 when unset.
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_CALLBACK_URL?: string;

  // Express "trust proxy" setting. Needed behind Vercel's proxy so that
  // req.ip (used by the rate limiter) is the real client IP.
  TRUST_PROXY: number | boolean;
}

const requiredEnvVariables = [
  'DB_URL',
  'NODE_ENV',
  'FRONTEND_URL',
  'BCRYPT_SALT_ROUND',
  'JWT_ACCESS_SECRET',
  'JWT_ACCESS_EXPIRES',
  'JWT_REFRESH_SECRET',
  'JWT_REFRESH_EXPIRES',
  'SUPER_ADMIN_EMAIL',
  'SUPER_ADMIN_PASSWORD',
] as const;

const parseTrustProxy = (value: string | undefined): number | boolean => {
  if (value === undefined || value === '') {
    // Vercel sets VERCEL=1 and sits exactly one proxy hop in front of the app.
    return process.env.VERCEL ? 1 : false;
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  const hops = Number(value);
  if (!Number.isInteger(hops) || hops < 0) {
    throw new Error('TRUST_PROXY must be true, false or a hop count');
  }
  return hops;
};

const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, '');

const loadEnvVariables = (): EnvConfig => {
  const missing = requiredEnvVariables.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}`,
    );
  }

  const nodeEnv = process.env.NODE_ENV as string;
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, production or test');
  }

  // bcrypt cost is exponential: 2^rounds iterations. Values above ~14 make
  // every login take seconds; values below 8 are too weak.
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUND);
  if (!Number.isInteger(saltRounds) || saltRounds < 8 || saltRounds > 14) {
    throw new Error('BCRYPT_SALT_ROUND must be an integer between 8 and 14');
  }

  if (
    nodeEnv === 'production' &&
    process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET
  ) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }

  const frontendUrl = normalizeOrigin(process.env.FRONTEND_URL as string);
  const extraOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  return {
    PORT: process.env.PORT || '5000',
    NODE_ENV: nodeEnv as EnvConfig['NODE_ENV'],
    DB_URL: process.env.DB_URL as string,
    FRONTEND_URL: frontendUrl,
    CORS_ORIGINS: Array.from(new Set([frontendUrl, ...extraOrigins])),
    BCRYPT_SALT_ROUND: saltRounds,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET as string,
    JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES as string,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET as string,
    JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES as string,
    SUPER_ADMIN_EMAIL: (process.env.SUPER_ADMIN_EMAIL as string).toLowerCase(),
    SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD as string,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || undefined,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || undefined,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || undefined,
    TRUST_PROXY: parseTrustProxy(process.env.TRUST_PROXY),
  };
};

export const envVars = loadEnvVariables();

export const isGoogleAuthEnabled = Boolean(
  envVars.GOOGLE_CLIENT_ID &&
    envVars.GOOGLE_CLIENT_SECRET &&
    envVars.GOOGLE_CALLBACK_URL,
);
