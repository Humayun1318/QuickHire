import express from 'express';
import { checkAuth } from '../../middlewares/checkAuth';
import { validateRequestBody } from '../../middlewares/validateRequest';
import { seekerExperienceController } from './seekerExperience.controller';
import { seekerExperienceValidation } from './seekerExperience.validation';
import { UserRole } from '../user/user.interface';

const router = express.Router();

router.post(
  '/create',
  checkAuth(UserRole.SEEKER),
  validateRequestBody(seekerExperienceValidation.createExperienceSchema),
  seekerExperienceController.createExperience,
);

router.get(
  '/list',
  checkAuth(UserRole.SEEKER),
  seekerExperienceController.getMyExperiences,
);

router.patch(
  '/update/:experienceId',
  checkAuth(UserRole.SEEKER),
  validateRequestBody(seekerExperienceValidation.updateExperienceSchema),
  seekerExperienceController.updateExperience,
);

router.delete(
  '/delete/:experienceId',
  checkAuth(UserRole.SEEKER),
  seekerExperienceController.deleteExperience,
);

export const seekerExperienceRoutes = router;
