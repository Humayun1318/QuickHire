import { Router } from 'express';
import { checkAuth } from '../../middlewares/checkAuth';
import { validateRequest } from '../../middlewares/validateRequest';
import { companyMemberController } from './companyMember.controller';
import { companyMemberValidation } from './companyMember.validation';
import { UserRole } from '../user/user.interface';

// mergeParams: true — allows access to :companyId from the parent router
const router = Router({ mergeParams: true });

// Add member — employer only (OWNER/ADMIN check happens in service)
router.post(
  '/',
  checkAuth(UserRole.EMPLOYER),
  validateRequest(companyMemberValidation.addMemberSchemaValidation),
  companyMemberController.addMember,
);

// Get all members — employer and admin
router.get(
  '/',
  checkAuth(UserRole.EMPLOYER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  companyMemberController.getCompanyMembers,
);

// Leave company — any member except owner
router.delete(
  '/leave/:companyId',
  checkAuth(UserRole.EMPLOYER),
  companyMemberController.leaveCompany,
);

// Update role — employer only (OWNER/ADMIN check in service)
router.patch(
  '/:memberId',
  checkAuth(UserRole.EMPLOYER),
  validateRequest(companyMemberValidation.updateMemberRoleSchemaValidation),
  companyMemberController.updateMemberRole,
);

// Remove member — employer only (OWNER/ADMIN check in service)
router.delete(
  '/:companyId/:memberId',
  checkAuth(UserRole.EMPLOYER),
  companyMemberController.removeMember,
);

export const companyMemberRoutes = router;
