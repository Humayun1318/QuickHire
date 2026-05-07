
import express from 'express';
import { checkAuth } from '../../middlewares/checkAuth';
import { validateRequest } from '../../middlewares/validateRequest';
import { seekerExperienceController } from './seekerExperience.controller';
import { seekerExperienceValidation } from './seekerExperience.validation';
import { UserRole } from '../user/user.interface';

const router = express.Router();

router.post(
    '/',
    checkAuth(UserRole.SEEKER),
    validateRequest(seekerExperienceValidation.createExperienceSchema),
    seekerExperienceController.createExperience,
);

router.get(
    '/',
    checkAuth(UserRole.SEEKER),
    seekerExperienceController.getMyExperiences,
);

router.patch(
    '/:experienceId',
    checkAuth(UserRole.SEEKER),
    validateRequest(seekerExperienceValidation.updateExperienceSchema),
    seekerExperienceController.updateExperience,
);

router.delete(
    '/:experienceId',
    checkAuth(UserRole.SEEKER),
    seekerExperienceController.deleteExperience,
);

export const seekerExperienceRoutes = router;