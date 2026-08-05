

import express from 'express';
import { checkAuth } from '../../middlewares/checkAuth';
import { validateRequest } from '../../middlewares/validateRequest';
import { jobCategoryController } from './jobCategory.controller';
import { jobCategoryValidation } from './jobCategory.validation';
import { UserRole } from '../user/user.interface';

const router = express.Router();

// ── Public routes — no auth needed ──────────────────────────

// Full tree for navigation menus
router.get('/tree', jobCategoryController.getCategoryTree);

// Root categories for homepage
router.get('/roots', jobCategoryController.getRootCategories);

// Category detail + breadcrumb by slug
router.get('/slug/:slug', jobCategoryController.getCategoryBySlug);

// Children of a category (for dynamic dropdown)
router.get('/:categoryId/children', jobCategoryController.getChildCategories);

// ── Admin-only routes ────────────────────────────────────────

// Flat list for admin panel management
router.get(
    '/',
    checkAuth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    jobCategoryController.getAllCategories,
);

router.post(
    '/',
    checkAuth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    validateRequest(jobCategoryValidation.createCategorySchema),
    jobCategoryController.createCategory,
);

router.patch(
    '/:categoryId',
    checkAuth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    validateRequest(jobCategoryValidation.updateCategorySchema),
    jobCategoryController.updateCategory,
);

router.delete(
    '/:categoryId',
    checkAuth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    jobCategoryController.deleteCategory,
);

export const jobCategoryRoutes = router;