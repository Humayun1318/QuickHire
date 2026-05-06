import { NextFunction, Request, Response, Router } from 'express';
import { authController } from './auth.controller';
import { validateRequest } from '../../middlewares/validateRequest';
import { authValidation } from './auth.validation';
import { checkAuth } from '../../middlewares/checkAuth';
import { UserRole } from '../user/user.interface';
import passport from 'passport';
import { envVars } from '../../config/env';

const router = Router();

// Authentication routes________________________________
router.post(
  '/login',
  validateRequest(authValidation.loginSchema),
  authController.createAuth,
);
router.post(
  '/refresh-token',
  authController.getNewAccessTokenUsingRefreshToken,
);
router.post('/logout', authController.logout);

// Protected route for changing password___________________
router.post(
  '/change-password',
  checkAuth(...Object.values(UserRole)),
  authController.changePassword,
);

// Google OAuth routes _____________________________________
router.get(
  '/google',
  async (req: Request, res: Response, next: NextFunction) => {
    const redirect = req.query.redirect || '/';
    const role = req.query.role || UserRole.SEEKER; // default to SEEKER if role is not provided
    const state = JSON.stringify({
      redirect,
      role,
    });
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      state,
    })(req, res, next);
  },
);

router.get(
  '/google/callback',
  authController.googleCallbackController,
);
//________________________________________________________


router.patch('/update/:id', authController.updateAuth);
router.delete('/delete/:id', authController.deleteAuth);
router.get('/:id', authController.getAuthById);
router.get('/', authController.getAllAuth);

export const authRoutes = router;
