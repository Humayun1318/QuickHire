import { Router } from 'express';
import { seekerEducationController } from './seekerEducation.controller';

const router = Router();

router.post('/create', seekerEducationController.createSeekerEducation);
router.patch('/update/:id', seekerEducationController.updateSeekerEducation);
router.delete('/delete/:id', seekerEducationController.deleteSeekerEducation);
router.get('/:id', seekerEducationController.getSeekerEducationById);
router.get('/', seekerEducationController.getAllSeekerEducation);

export const seekerEducationRoutes = router;