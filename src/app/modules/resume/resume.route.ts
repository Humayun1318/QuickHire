import { Router } from 'express';
import { checkAuth } from '../../middlewares/checkAuth';
import { validateRequestBody } from '../../middlewares/validateRequest';
import { resumeController } from './resume.controller';
import { resumeValidation } from './resume.validation';
import { UserRole } from '../user/user.interface';
const router = Router();
// All resume endpoints are seeker-only — managed by the applicant.
// Employers never manage resumes directly; they receive a resume
// through the application an applicant submits.
// ─────────────────────────────────────────────────────────────
// Create — seeker uploads a new resume
router.post(
  '/create',
  checkAuth(UserRole.SEEKER),
  validateRequestBody(resumeValidation.createResumeSchema),
  resumeController.createResume,
);
// List — seeker's own resumes
router.get('/', checkAuth(UserRole.SEEKER), resumeController.getMyResumes);
// Single resume — must belong to the requester
router.get(
  '/:resumeId',
  checkAuth(UserRole.SEEKER),
  resumeController.getResumeById,
);
// Update — title / file URL
router.patch(
  '/:resumeId',
  checkAuth(UserRole.SEEKER),
  validateRequestBody(resumeValidation.updateResumeSchema),
  resumeController.updateResume,
);
// Delete — soft delete with default-promotion fallback
router.delete(
  '/:resumeId',
  checkAuth(UserRole.SEEKER),
  resumeController.deleteResume,
);
// Pick the default resume used when applying
router.patch(
  '/:resumeId/set-default',
  checkAuth(UserRole.SEEKER),
  resumeController.setDefaultResume,
);
export const resumeRoutes = router;
