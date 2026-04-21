import { NextFunction, Request, Response, Router } from 'express';
import { authController } from './auth.controller';
import { validateRequest } from '../../middlewares/validateRequest';
import { authValidation } from './auth.validation';
import { checkAuth } from '../../middlewares/checkAuth';
import { Role } from '../user/user.interface';
import passport from 'passport';
import { envVars } from '../../config/env';

const router = Router();

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
router.post(
  '/change-password',
  checkAuth(...Object.values(Role)),
  authController.changePassword,
);

//  /booking -> /login -> succesful google login -> /booking frontend
// /login -> succesful google login -> / frontend
router.get(
  '/google',
  async (req: Request, res: Response, next: NextFunction) => {
    const redirect = req.query.redirect || '/';
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      state: redirect as string,
      // session: false,
    })(req, res, next);
  },
);

// api/v1/auth/google/callback?state=/booking
router.get(
  '/google/callback',
  passport.authenticate('google', {
    // session: false,
    failureRedirect: `${envVars.FRONTEND_URL}/login?error=There is some issues with your account. Please contact with our support team!`,
  }),
  authController.googleCallbackController,
);

router.patch('/update/:id', authController.updateAuth);
router.delete('/delete/:id', authController.deleteAuth);
router.get('/:id', authController.getAuthById);
router.get('/', authController.getAllAuth);

export const authRoutes = router;
