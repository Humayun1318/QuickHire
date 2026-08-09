import { Router } from 'express';
import { checkAuth } from '../../middlewares/checkAuth';
import { validateRequestBody } from '../../middlewares/validateRequest';
import { companyController } from './company.controller';
import { companyValidation } from './company.validation';
import { UserRole } from '../user/user.interface';

const router = Router();

// Create — employer only, one company per employer enforced in service
router.post(
  '/',
  checkAuth(UserRole.EMPLOYER),
  validateRequestBody(companyValidation.createCompanySchema),
  companyController.createCompany,
);

// Get own company — employer only
router.get('/me', checkAuth(UserRole.EMPLOYER), companyController.getMyCompany);

// Get by slug — public (seekers browsing companies)
router.get('/', companyController.getSingleCompany);

// Update own company — employer only
router.patch(
  '/:companyId',
  checkAuth(UserRole.EMPLOYER),
  validateRequestBody(companyValidation.updateCompanySchema),
  companyController.updateCompany,
);

// Soft delete — employer only
router.delete(
  '/:companyId',
  checkAuth(UserRole.EMPLOYER),
  companyController.deleteCompany,
);

// Admin: update verification status
router.patch(
  '/:companyId/verification',
  checkAuth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequestBody(companyValidation.updateVerificationSchema),
  companyController.updateVerificationStatus,
);

export const companyRoutes = router;
