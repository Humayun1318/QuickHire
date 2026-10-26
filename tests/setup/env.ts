import { inject } from 'vitest';
import crypto from 'crypto';

/**
 * env.ts validates variables at import time, so they must be set before the
 * app is imported by a test file. Each test file gets its own database.
 */
const baseUri = inject('mongoUri');
const dbName = `quickhire_test_${crypto.randomBytes(4).toString('hex')}`;
const url = new URL(baseUri);
url.pathname = `/${dbName}`;

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: '0',
  DB_URL: url.toString(),
  FRONTEND_URL: 'http://localhost:3000',
  CORS_ORIGINS: 'http://localhost:5173',
  BCRYPT_SALT_ROUND: '8',
  JWT_ACCESS_SECRET: 'test-access-secret',
  JWT_ACCESS_EXPIRES: '1h',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  JWT_REFRESH_EXPIRES: '7d',
  SUPER_ADMIN_EMAIL: 'superadmin@test.com',
  SUPER_ADMIN_PASSWORD: 'SuperAdmin1!',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  GOOGLE_CALLBACK_URL: '',
  TRUST_PROXY: 'false',
});
