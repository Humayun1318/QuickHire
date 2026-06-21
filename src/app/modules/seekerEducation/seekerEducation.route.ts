import express from 'express';
import { checkAuth } from '../../middlewares/checkAuth';
import { validateRequest } from '../../middlewares/validateRequest';
import { seekerEducationController } from './seekerEducation.controller';
import { seekerEducationValidation } from './seekerEducation.validation';
import { UserRole } from '../user/user.interface';

const router = express.Router();

router.post(
  '/create',
  checkAuth(UserRole.SEEKER),
  validateRequest(seekerEducationValidation.createEducationSchema),
  seekerEducationController.createEducation,
);

router.get(
  '/list',
  checkAuth(UserRole.SEEKER),
  seekerEducationController.getMyEducations,
);

router.patch(
  '/update/:educationId',
  checkAuth(UserRole.SEEKER),
  validateRequest(seekerEducationValidation.updateEducationSchema),
  seekerEducationController.updateEducation,
);

router.delete(
  '/delete/:educationId',
  checkAuth(UserRole.SEEKER),
  seekerEducationController.deleteEducation,
);

export const seekerEducationRoutes = router;