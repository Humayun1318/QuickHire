import { Router } from 'express';
import { jobListingRoutes } from '../modules/jobListing/jobListing.route';
import { ApplicationRoutes } from '../modules/Application/Application.route';

export const router = Router();

const moduleRoutes = [
  {
    path: '/jobs',
    route: jobListingRoutes,
  },
  {
    path: '/applications',
    route: ApplicationRoutes,
  },
];

moduleRoutes.forEach((route) => {
  router.use(route.path, route.route);
});
