import { Router } from 'express';
import { authController } from './auth.controller';
import { validateRequest } from '../../middlewares/validateRequest';
import { authValidation } from './auth.validation';
import { checkAuth } from '../../middlewares/checkAuth';
import { Role } from '../user/user.interface';

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

router.patch('/update/:id', authController.updateAuth);
router.delete('/delete/:id', authController.deleteAuth);
router.get('/:id', authController.getAuthById);
router.get('/', authController.getAllAuth);

export const authRoutes = router;
