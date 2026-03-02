import { Router } from 'express';
import { applicationController } from './Application.controller';

const router = Router();

router.post('/create', applicationController.submitApplication);
router.delete('/delete/:id', applicationController.deleteApplication);
router.get('/:id', applicationController.getApplicationById);
router.get('/', applicationController.getApplicationsByJobId);

export const ApplicationRoutes = router;
