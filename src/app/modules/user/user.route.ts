import { Router } from 'express';
import { userController } from './user.controller';
import { validateRequest } from '../../middlewares/validateRequest';
import { createUserZodSchema } from './user.validation';
import { checkAuth } from '../../middlewares/checkAuth';
import { UserRole } from './user.interface';


// Initialize Express router for user routes
const router = Router();

router.post(
  '/register',
  validateRequest(createUserZodSchema),
  userController.createUser,
);

router.patch('/update/:id', userController.updateUser);
router.delete('/delete/:id', userController.deleteUser);
router.get('/:id', userController.getUserById);

router.get(
  '/',
  checkAuth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  userController.getAllUser,
);

// Export router for use in main routes
export const userRoutes = router;
