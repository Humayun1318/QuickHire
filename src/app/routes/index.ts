import { Router } from 'express';
import { jobListingRoutes } from '../modules/jobListing/jobListing.route';
import { ApplicationRoutes } from '../modules/Application/Application.route';
import { userRoutes } from '../modules/user/user.route';
import { authRoutes } from '../modules/auth/auth.route';

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
  {
    path: '/users',
    route: userRoutes,
  },
  {
    path: '/auth',
    route: authRoutes,
  },
];

moduleRoutes.forEach((route) => {
  router.use(route.path, route.route);
});
