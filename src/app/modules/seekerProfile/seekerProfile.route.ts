
import { Router } from 'express';
import { checkAuth } from '../../middlewares/checkAuth';
import { validateRequest } from '../../middlewares/validateRequest';
import { seekerProfileController } from './seekerProfile.controller';
import { seekerProfileValidation } from './seekerProfile.validation';
import { UserRole } from '../user/user.interface';

const router = Router();

// Create profile — seeker only (one per user, enforced in service)
router.post(
    '/create',
    checkAuth(UserRole.SEEKER),
    validateRequest(seekerProfileValidation.createSeekerProfileSchema),
    seekerProfileController.createSeekerProfile,
);

// Get own profile — seeker only
router.get(
    '/me',
    checkAuth(UserRole.SEEKER),
    seekerProfileController.getMyProfile,
);

// Get any public profile — employers and admins can view
router.get(
    '/',
    checkAuth(UserRole.EMPLOYER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
    seekerProfileController.getProfileById,
);

// Update own profile — seeker only
router.patch(
    '/update',
    checkAuth(UserRole.SEEKER),
    validateRequest(seekerProfileValidation.updateSeekerProfileSchema),
    seekerProfileController.updateSeekerProfile,
);

// Soft delete own profile
router.delete(
    '/me',
    checkAuth(UserRole.SEEKER),
    seekerProfileController.deleteSeekerProfile,
);

export const seekerProfileRoutes = router;