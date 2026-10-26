/**
 * @file db.ts
 * @description MongoDB connection management shared by the local server
 * (src/server.ts) and the Vercel serverless function (src/app.ts).
 *
 * On Vercel a function instance is reused across many requests, so the
 * connection promise is cached at module level: the first request on a cold
 * instance connects, later requests reuse the same connection pool.
 */

import mongoose from 'mongoose';
import { envVars } from './env';
import { seedSuperAdmin } from '../utils/seedSuperAdmin';

let connectionPromise: Promise<typeof mongoose> | null = null;

export const connectDB = async (): Promise<typeof mongoose> => {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(envVars.DB_URL, {
        // Fail fast instead of hanging a request for 30s when the DB is down.
        serverSelectionTimeoutMS: 10000,
        // Small pool: each serverless instance holds its own pool.
        maxPoolSize: 10,
      })
      .then(async (conn) => {
        // Idempotent: creates the super admin only if it does not exist yet.
        await seedSuperAdmin();
        return conn;
      })
      .catch((error) => {
        // Allow the next request to retry instead of caching the failure.
        connectionPromise = null;
        throw error;
      });
  }

  return connectionPromise;
};

export const disconnectDB = async () => {
  connectionPromise = null;
  await mongoose.disconnect();
};
