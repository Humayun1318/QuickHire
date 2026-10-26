import './app/config/passport';

import { envVars } from './app/config/env';
import cors, { CorsOptions } from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { globalErrorHandler } from './app/middlewares/globalErrorHandler';
import notFound from './app/middlewares/notFound';
import { router } from './app/routes';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { connectDB } from './app/config/db';
import { apiLimiter } from './app/middlewares/rateLimiter';
import AppError from './app/errorHelpers/AppError';
import { HTTP_STATUS_CODE } from './app/utils/HTTP_STATUS_CODE';

const app = express();

/**
 * Trust the platform proxy (Vercel) so req.ip is the real client address.
 * Only the configured number of hops is trusted — never arbitrary
 * client-supplied X-Forwarded-For chains.
 */
app.set('trust proxy', envVars.TRUST_PROXY);
app.disable('x-powered-by');

/**
 * Security headers. This is a JSON-only API, so Helmet's defaults (strict CSP,
 * nosniff, frameguard, HSTS, etc.) apply without exceptions.
 */
app.use(helmet());

/**
 * CORS: only the configured frontend origin(s) may call the API with
 * credentials. Requests without an Origin header (curl, server-to-server,
 * same-origin navigation) are allowed; browser requests from any other origin
 * are rejected with 403 so cookie-authenticated cross-site requests (CSRF)
 * never reach a handler.
 */
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || envVars.CORS_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(
      new AppError(HTTP_STATUS_CODE.FORBIDDEN, 'Origin not allowed by CORS'),
    );
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

/**
 * Parse cookies and JSON bodies. Bodies are capped well below Vercel's 4.5 MB
 * function payload limit; this API never needs large payloads.
 */
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));

/**
 * Passport is used without sessions: local login and Google OAuth both issue
 * JWTs (see auth.controller.ts), so no session store is required — important
 * for stateless serverless deployment.
 */
app.use(passport.initialize());

/**
 * Health check — does not touch the database.
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'QuickHire API is running' });
});

/**
 * General rate limit, applied before any database work.
 */
app.use('/api/v1', apiLimiter);

/**
 * Ensure a MongoDB connection before any API route runs. The connection is
 * cached, so this is a no-op after the first request on an instance.
 */
app.use(
  '/api/v1',
  async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      await connectDB();
      next();
    } catch (error) {
      console.error('Database connection failed:', (error as Error).message);
      next(
        new AppError(
          HTTP_STATUS_CODE.SERVICE_UNAVAILABLE,
          'Service temporarily unavailable',
        ),
      );
    }
  },
);

/**
 * Register API Routes (versioned under /api/v1).
 */
app.use('/api/v1', router);

/**
 * 404 for unmatched routes, then the centralized error handler (must be last).
 */
app.use(notFound);
app.use(globalErrorHandler);

export default app;
