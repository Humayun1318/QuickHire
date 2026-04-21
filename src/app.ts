/**
 * @file app.ts
 * @description Express application configuration and middleware setup
 * This file configures all middlewares, authentication strategies, and routes
 */

// Import and initialize Passport authentication strategies (Google OAuth, Local)
import './app/config/passport';

import { envVars } from './app/config/env';
import cors from 'cors';
import express, { Request, Response } from 'express';
import expressSession from 'express-session';
import { globalErrorHandler } from './app/middlewares/globalErrorHandler';
import notFound from './app/middlewares/notFound';
import { router } from './app/routes';
import cookieParser from 'cookie-parser';
import passport from 'passport';

// Initialize Express application
const app = express();

/**
 * Configure Express Session Middleware
 * Purpose: Enable server-side session management for storing user authentication state
 * - secret: Encryption key for session data (from environment variables)
 * - resave: Don't save unchanged session data to memory store
 * - saveUninitialized: Don't save uninitialized sessions
 */
app.use(
  expressSession({
    secret: envVars.EXPRESS_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  }),
);

/**
 * Initialize Passport Authentication Middleware
 * Enables support for various authentication strategies (Google OAuth, Local Strategy)
 */
app.use(passport.initialize());

/**
 * Enable Passport Session Support
 * Serializes/deserializes user data to/from sessions
 */
app.use(passport.session());

/**
 * Parse cookies from incoming requests
 * Makes cookies accessible via req.cookies object
 */
app.use(cookieParser());

/**
 * Parse JSON request bodies
 * Automatically converts incoming JSON payloads to JavaScript objects
 */
app.use(express.json());

/**
 * Configure Cross-Origin Resource Sharing (CORS)
 * Purpose: Allow the frontend application to make cross-origin requests to this API
 * - origin: Only accept requests from the frontend URL specified in env variables
 * - credentials: Allow cookies and authentication headers in cross-origin requests
 */
app.use(
  cors({
    origin: envVars.FRONTEND_URL,
    credentials: true,
  }),
);

/**
 * Register API Routes
 * All routes are prefixed with /api/v1 for API versioning
 * Routes include: authentication, user management, job listings, and applications
 */
app.use('/api/v1', router);

/**
 * Global Error Handler Middleware
 * Catches all errors thrown in route handlers and sends formatted error responses
 * Must be registered after all other middleware and routes
 */
app.use(globalErrorHandler);

/**
 * 404 Not Found Middleware
 * Handles requests to routes that don't exist
 * Must be the last middleware to catch unmatched routes
 */
app.use(notFound);

// Export configured Express application
export default app;
