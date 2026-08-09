import express from 'express';
import { checkAuth } from '../../middlewares/checkAuth';
import { validateRequestBody } from '../../middlewares/validateRequest';
import { seekerEducationController } from './seekerEducation.controller';
import { seekerEducationValidation } from './seekerEducation.validation';
import { UserRole } from '../user/user.interface';

const router = express.Router();

router.post(
  '/create',
  checkAuth(UserRole.SEEKER),
  validateRequestBody(seekerEducationValidation.createEducationSchema),
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
  validateRequestBody(seekerEducationValidation.updateEducationSchema),
  seekerEducationController.updateEducation,
);

router.delete(
  '/delete/:educationId',
  checkAuth(UserRole.SEEKER),
  seekerEducationController.deleteEducation,
);

export const seekerEducationRoutes = router;
