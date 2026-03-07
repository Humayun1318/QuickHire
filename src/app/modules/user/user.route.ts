import { Router } from 'express';
import { userController } from './user.controller';
import { validateRequest } from '../../middlewares/validateRequest';
import { createUserZodSchema } from './user.validation';

const router = Router();

router.post(
  '/register',
  validateRequest(createUserZodSchema),
  userController.createUser,
);
router.patch('/update/:id', userController.updateUser);
router.delete('/delete/:id', userController.deleteUser);
router.get('/:id', userController.getUserById);
router.get('/', userController.getAllUser);

export const userRoutes = router;
