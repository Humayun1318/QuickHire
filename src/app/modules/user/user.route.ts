import { Router } from 'express';
import { userController } from './user.controller';

const router = Router();

router.post('/create', userController.createUser);
router.patch('/update/:id', userController.updateUser);
router.delete('/delete/:id', userController.deleteUser);
router.get('/:id', userController.getUserById);
router.get('/', userController.getAllUser);

export const userRoutes = router;