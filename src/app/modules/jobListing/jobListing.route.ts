import express from 'express';
import { checkAuth } from '../../middlewares/checkAuth';
import {
  validateRequestBody,
  validateRequestQuery,
} from '../../middlewares/validateRequest';
import { jobListingController } from './jobListing.controller';
import { jobListingValidation } from './jobListing.validation';
import { UserRole } from '../user/user.interface';

const router = express.Router();

// ── Public ───────────────────────────────────────────────────
router.get(
  '/',
  validateRequestQuery(jobListingValidation.jobSearchQuerySchema),
  jobListingController.searchJobs,
);
router.get('/slug/:slug', jobListingController.getJobBySlug);

// ── Company dashboard (members see drafts / closed jobs) ────
router.get(
  '/company/:companyId',
  checkAuth(UserRole.EMPLOYER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequestQuery(jobListingValidation.companyJobsQuerySchema),
  jobListingController.getCompanyJobs,
);

router.get('/:jobId', jobListingController.getJobById);

// ── Employer (company OWNER / ADMIN / HR / RECRUITER) ────────
router.post(
  '/',
  checkAuth(UserRole.EMPLOYER),
  validateRequestBody(jobListingValidation.createJobSchema),
  jobListingController.createJob,
);

router.patch(
  '/:jobId',
  checkAuth(UserRole.EMPLOYER),
  validateRequestBody(jobListingValidation.updateJobSchema),
  jobListingController.updateJob,
);

router.patch(
  '/:jobId/status',
  checkAuth(UserRole.EMPLOYER),
  validateRequestBody(jobListingValidation.updateStatusSchema),
  jobListingController.updateJobStatus,
);

router.delete(
  '/:jobId',
  checkAuth(UserRole.EMPLOYER),
  jobListingController.deleteJob,
);

// ── Platform admin ───────────────────────────────────────────
router.patch(
  '/:jobId/featured',
  checkAuth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequestBody(jobListingValidation.toggleFeaturedSchema),
  jobListingController.toggleFeatured,
);

export const jobListingRoutes = router;
