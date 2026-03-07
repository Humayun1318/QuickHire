import { Router } from 'express';
import { authController } from './auth.controller';

const router = Router();

router.post('/login', authController.createAuth);
router.patch('/update/:id', authController.updateAuth);
router.delete('/delete/:id', authController.deleteAuth);
router.get('/:id', authController.getAuthById);
router.get('/', authController.getAllAuth);

export const authRoutes = router;