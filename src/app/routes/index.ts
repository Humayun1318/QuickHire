/**
 * @file routes/index.ts
 * @description Central API routing configuration
 * This file aggregates all module routes and registers them with the main Express router
 * Provides a single point to manage all API endpoints
 */

import { Router } from 'express';
import { jobListingRoutes } from '../modules/jobListing/jobListing.route';
import { ApplicationRoutes } from '../modules/Application/Application.route';
import { userRoutes } from '../modules/user/user.route';
import { authRoutes } from '../modules/auth/auth.route';

// Initialize Express router for API routes
export const router = Router();

/**
 * Module routes configuration
 * Array of objects mapping API path prefixes to their corresponding route handlers
 *
 * Structure:
 * - path: URL prefix for the module (e.g., /jobs, /users)
 * - route: Router instance from the module containing specific endpoint handlers
 */
const moduleRoutes = [
  {
    // Job listing endpoints: /api/v1/jobs
    path: '/jobs',
    route: jobListingRoutes,
  },
  {
    // Job application endpoints: /api/v1/applications
    path: '/applications',
    route: ApplicationRoutes,
  },
  {
    // User management endpoints: /api/v1/users
    path: '/users',
    route: userRoutes,
  },
  {
    // Authentication endpoints: /api/v1/auth
    path: '/auth',
    route: authRoutes,
  },
];

/**
 * Register all module routes with the main router
 * Dynamically mounts each module's routes at its specified path
 *
 * This pattern provides:
 * - Clean separation of concerns (each module manages its own routes)
 * - Easy addition of new modules (just add to moduleRoutes array)
 * - Centralized route management
 * - Clear visibility of all available API endpoints
 */
moduleRoutes.forEach((route) => {
  router.use(route.path, route.route);
});
