import { Router } from 'express';
import { jobListingRoutes } from '../modules/jobListing/jobListing.route';
import { resumeRoutes } from '../modules/resume/resume.route';
import { ApplicationRoutes } from '../modules/Application/Application.route';
import { userRoutes } from '../modules/user/user.route';
import { authRoutes } from '../modules/auth/auth.route';
import { seekerExperienceRoutes } from '../modules/seekerExperience/seekerExperience.route';
import { seekerEducationRoutes } from '../modules/seekerEducation/seekerEducation.route';
import { seekerProfileRoutes } from '../modules/seekerProfile/seekerProfile.route';
import { companyRoutes } from '../modules/company/company.route';
import { companyMemberRoutes } from '../modules/companyMember/companyMember.route';
import { jobCategoryRoutes } from '../modules/jobCategory/jobCategory.route';

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
  {
    path: '/seeker-profiles',
    route: seekerProfileRoutes,
  },
  {
    path: '/seeker-educations',
    route: seekerEducationRoutes,
  },
  {
    path: '/seeker-experiences',
    route: seekerExperienceRoutes,
  },
  {
    path: '/companies',
    route: companyRoutes,
  },
  {
    path: '/companies/members',
    route: companyMemberRoutes,
  },
  {
    path: '/job-categories',
    route: jobCategoryRoutes,
  },
  {
    path: '/jobs',
    route: jobListingRoutes,
  },
  {
    // Resume management — seeker-only (1:N with User & Application)
    path: '/resumes',
    route: resumeRoutes,
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
