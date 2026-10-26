import { Router } from 'express';
import { userController } from './user.controller';
import { checkAuth } from '../../middlewares/checkAuth';
import { UserRole } from './user.interface';
import { validateRequestQuery } from '../../middlewares/validateRequest';
import { userQuerySchema } from './user.validation';

const router = Router();

router.get('/me', checkAuth(...Object.values(UserRole)), userController.getMe);

router.get(
  '/',
  checkAuth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequestQuery(userQuerySchema),
  userController.getAllUser,
);

router.get(
  '/:id',
  checkAuth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  userController.getUserById,
);

export const userRoutes = router;
