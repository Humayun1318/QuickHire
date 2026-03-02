import { Router } from 'express';
import { jobListingController } from './jobListing.controller';

const router = Router();

router.post('/create', jobListingController.createJobListing);
router.patch('/update/:id', jobListingController.updateJobListing);
router.delete('/delete/:id', jobListingController.deleteJobListing);
router.get('/:id', jobListingController.getJobListingById);
router.get('/', jobListingController.getAllJobListing);

export const jobListingRoutes = router;