

import express from 'express';
import { checkAuth }           from '../../middlewares/checkAuth';
import { validateRequest }     from '../../middlewares/validateRequest';
import { jobListingController } from './jobListing.controller';
import { jobListingValidation } from './jobListing.validation';
import { UserRole } from '../user/user.interface';

const router = express.Router();

// ── Public routes ────────────────────────────────────────────

// Search and filter — main job board
router.get(
  '/',
  validateRequest(jobListingValidation.jobSearchQuerySchema),
  jobListingController.searchJobs,
);

// Job detail by slug — SEO-friendly URL
router.get('/slug/:slug', jobListingController.getJobBySlug);

// Job detail by ID
router.get('/:jobId', jobListingController.getJobById);

// ── Employer routes ──────────────────────────────────────────

// Create job posting
router.post(
  '/',
  checkAuth(UserRole.EMPLOYER),
  validateRequest(jobListingValidation.createJobSchema),
  jobListingController.createJob,
);

// Update job content
router.patch(
  '/:jobId',
  checkAuth(UserRole.EMPLOYER),
  validateRequest(jobListingValidation.updateJobSchema),
  jobListingController.updateJob,
);

// Update job status (draft/published/closed)
router.patch(
  '/:jobId/status',
  checkAuth(UserRole.EMPLOYER),
  validateRequest(jobListingValidation.updateStatusSchema),
  jobListingController.updateJobStatus,
);

// Soft delete
router.delete(
  '/:jobId',
  checkAuth(UserRole.EMPLOYER),
  jobListingController.deleteJob,
);

// ── Admin routes ─────────────────────────────────────────────

// Toggle featured status
router.patch(
  '/:jobId/featured',
  checkAuth(UserRole.ADMIN),
  jobListingController.toggleFeatured,
);

export const jobListingRoutes = router;