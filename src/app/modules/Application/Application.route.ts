import { Router } from 'express';
import { checkAuth } from '../../middlewares/checkAuth';
import { validateRequestBody } from '../../middlewares/validateRequest';
import { applicationController } from './Application.controller';
import { applicationValidation } from './Application.validation';
import { UserRole } from '../user/user.interface';
const router = Router();
// ── Seeker routes — apply & manage own applications ──────────
// Submit an application — SEEKER only, validated body
router.post(
  '/',
  checkAuth(UserRole.SEEKER),
  validateRequestBody(applicationValidation.createApplicationSchema),
  applicationController.submitApplication,
);
// List own applications
router.get(
  '/my-applications',
  checkAuth(UserRole.SEEKER),
  applicationController.getMyApplications,
);
// Withdraw own application — body { status: 'withdrawn' }
router.patch(
  '/:applicationId/withdraw',
  checkAuth(UserRole.SEEKER),
  validateRequestBody(applicationValidation.withdrawApplicationSchema),
  applicationController.withdrawApplication,
);
// ── Employer routes — review applications for their jobs ─────
// List applications submitted to one of their job listings
router.get(
  '/jobs/:jobId',
  checkAuth(UserRole.EMPLOYER),
  applicationController.getJobApplications,
);
// Review: update status / employer note / score
router.patch(
  '/:applicationId/review',
  checkAuth(UserRole.EMPLOYER),
  validateRequestBody(applicationValidation.employerReviewSchema),
  applicationController.reviewApplication,
);
// ── Admin routes — audit & support ───────────────────────────
// Retrieve a single application by id
router.get(
  '/:applicationId',
  checkAuth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  applicationController.getApplicationById,
);
export const ApplicationRoutes = router;
