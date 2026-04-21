/**
 * @file jobListing.route.ts
 * @description Job listing API routes
 * Defines all job listing CRUD endpoints
 */

import { Router } from 'express';
import { jobListingController } from './jobListing.controller';

// Initialize Express router for job listing routes
const router = Router();

/**
 * Create Job Listing Endpoint
 * HTTP Method: POST
 * Route: /api/v1/jobs/create
 *
 * Request Body:
 * {
 *   title: string,
 *   description: string,
 *   location: string,
 *   salary: number,
 *   company: string,
 *   requirements: string[],
 *   ...
 * }
 *
 * Response:
 * Status: 201 Created
 * Body: { statusCode: 201, success: true, message: 'Job listing created successfully', data: newJob }
 *
 * Authentication: TODO - Should require employer/admin role
 */
router.post('/create', jobListingController.createJobListing);

/**
 * Update Job Listing Endpoint
 * HTTP Method: PATCH
 * Route: /api/v1/jobs/update/:id
 *
 * Parameters:
 * - :id (URL parameter) - MongoDB ObjectID of job to update
 *
 * Request Body: Partial job data with fields to update
 *
 * Response:
 * Status: 200 OK
 * Body: { statusCode: 200, success: true, message: 'Job listing updated successfully', data: updatedJob }
 *
 * Authentication: TODO - Only job creator or admin should be able to update
 */
router.patch('/update/:id', jobListingController.updateJobListing);

/**
 * Delete Job Listing Endpoint
 * HTTP Method: DELETE
 * Route: /api/v1/jobs/delete/:id
 *
 * Parameters:
 * - :id (URL parameter) - MongoDB ObjectID of job to delete
 *
 * Important Side Effects:
 * - When a job is deleted, ALL associated applications are also deleted
 * - This maintains database referential integrity
 * - Applicants will no longer see this job in their applications
 *
 * Response:
 * Status: 200 OK
 * Body: { statusCode: 200, success: true, message: 'Job listing deleted successfully along with associated applications', data: deletedJob }
 *
 * Authentication: TODO - Only job creator or admin should be able to delete
 */
router.delete('/delete/:id', jobListingController.deleteJobListing);

/**
 * Get Job Listing by ID Endpoint
 * HTTP Method: GET
 * Route: /api/v1/jobs/:id
 *
 * Parameters:
 * - :id (URL parameter) - MongoDB ObjectID of job to retrieve
 *
 * Response:
 * Status: 200 OK
 * Body: { statusCode: 200, success: true, message: 'Job listing retrieved successfully', data: job }
 *
 * Note: Public endpoint - anyone can view job details
 * Use for displaying job details on frontend
 */
router.get('/:id', jobListingController.getJobListingById);

/**
 * Get All Job Listings Endpoint
 * HTTP Method: GET
 * Route: /api/v1/jobs
 *
 * Query Parameters: (Optional)
 * - page: Page number for pagination (e.g., ?page=1)
 * - limit: Number of jobs per page (e.g., ?limit=10)
 * - search: Search term to filter jobs by title/description (e.g., ?search=developer)
 * - company: Filter by company name
 * - location: Filter by job location
 * - minSalary: Filter jobs with minimum salary
 * - maxSalary: Filter jobs with maximum salary
 * - skills: Filter by required skills
 *
 * Example API calls:
 * GET /api/v1/jobs
 * GET /api/v1/jobs?page=2&limit=20
 * GET /api/v1/jobs?search=frontend&location=NYC
 * GET /api/v1/jobs?minSalary=50000&maxSalary=100000
 *
 * Response:
 * Status: 200 OK
 * Body: { statusCode: 200, success: true, message: 'Job listings retrieved successfully', data: jobs[] }
 *
 * Note: Public endpoint - returns paginated list of all active jobs
 * Use for job search/listing pages on frontend
 */
router.get('/', jobListingController.getAllJobListing);

// Export router for use in main routes
export const jobListingRoutes = router;
