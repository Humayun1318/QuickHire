/**
 * @file rateLimiter.ts
 * @description Request rate limits (express-rate-limit).
 *
 * The limiters use the default in-memory store. On Vercel every function
 * instance keeps its own counters, so these limits are per instance, not a
 * global guarantee. They still blunt brute-force bursts, which mostly land on
 * a single warm instance. A shared store (e.g. Redis) would be needed for a
 * globally consistent limit — deliberately not added to keep this free-tier.
 */

import rateLimit from 'express-rate-limit';
import { envVars } from '../config/env';

const isTest = envVars.NODE_ENV === 'test';

const limitResponse = (message: string) => ({
  success: false,
  message,
  errorSources: [],
});

// Applied to every /api/v1 route.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => isTest,
  message: limitResponse('Too many requests, please try again later.'),
});

// Login, registration, token refresh and password change.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => isTest,
  message: limitResponse(
    'Too many authentication attempts, please try again in 15 minutes.',
  ),
});
