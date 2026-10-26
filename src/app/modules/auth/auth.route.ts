import { Router } from 'express';
import { authController } from './auth.controller';
import { validateRequestBody } from '../../middlewares/validateRequest';
import { authValidation } from './auth.validation';
import { checkAuth } from '../../middlewares/checkAuth';
import { UserRole } from '../user/user.interface';
import { authLimiter } from '../../middlewares/rateLimiter';

const router = Router();

// User registration (seeker or employer only)
router.post(
  '/register',
  authLimiter,
  validateRequestBody(authValidation.registerSchema),
  authController.createUser,
);

// Email + password login
router.post(
  '/login',
  authLimiter,
  validateRequestBody(authValidation.loginSchema),
  authController.credentialsLogin,
);

// Token refresh and logout
router.post(
  '/refresh-token',
  authLimiter,
  authController.getNewAccessTokenUsingRefreshToken,
);
router.post('/logout', authController.logout);

// Change password (any authenticated role)
router.post(
  '/change-password',
  authLimiter,
  checkAuth(...Object.values(UserRole)),
  validateRequestBody(authValidation.changePasswordSchema),
  authController.changePassword,
);

// Google OAuth (only active when GOOGLE_* env vars are configured)
router.get('/google', authLimiter, authController.googleLogin);
router.get('/google/callback', authController.googleCallbackController);

export const authRoutes = router;
