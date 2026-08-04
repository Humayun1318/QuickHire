import AppError from '../../errorHelpers/AppError';
import { HTTP_STATUS_CODE } from '../../utils/HTTP_STATUS_CODE';
import { CompanyMemberRole } from './companyMember.constants';

export const validateRoleAssignPermission = (
  requesterRole: CompanyMemberRole,
  assignedRole: CompanyMemberRole,
) => {
  if (requesterRole === CompanyMemberRole.OWNER) {
    return;
  }

  if (requesterRole === CompanyMemberRole.ADMIN) {
    if (
      assignedRole === CompanyMemberRole.ADMIN ||
      assignedRole === CompanyMemberRole.OWNER
    ) {
      throw new AppError(
        HTTP_STATUS_CODE.FORBIDDEN,
        'Admins cannot assign ADMIN or OWNER roles',
      );
    }

    return;
  }

  throw new AppError(
    HTTP_STATUS_CODE.FORBIDDEN,
    'You do not have permission to add members',
  );
};

// Validate that the requester has permission to update the target member's role
export const validateRoleUpdatePermission = (
  requesterRole: CompanyMemberRole,
  targetRole: CompanyMemberRole,
  newRole: CompanyMemberRole,
) => {
  // Owner role can never be changed
  if (targetRole === CompanyMemberRole.OWNER) {
    throw new AppError(
      HTTP_STATUS_CODE.FORBIDDEN,
      'Owner role cannot be changed',
    );
  }

  // No-op update
  if (targetRole === newRole) {
    throw new AppError(
      HTTP_STATUS_CODE.BAD_REQUEST,
      'Member already has this role',
    );
  }

  // OWNER can manage every non-owner role
  if (requesterRole === CompanyMemberRole.OWNER) {
    return;
  }

  // ADMIN permissions
  if (requesterRole === CompanyMemberRole.ADMIN) {
    // Cannot manage another ADMIN
    if (targetRole === CompanyMemberRole.ADMIN) {
      throw new AppError(
        HTTP_STATUS_CODE.FORBIDDEN,
        'Admins cannot update another admin',
      );
    }

    // Cannot promote anyone to ADMIN
    if (newRole === CompanyMemberRole.ADMIN) {
      throw new AppError(
        HTTP_STATUS_CODE.FORBIDDEN,
        'Admins cannot assign the ADMIN role',
      );
    }

    return;
  }

  throw new AppError(
    HTTP_STATUS_CODE.FORBIDDEN,
    'You do not have permission to update member roles',
  );
};

export const validateMemberRemovalPermission = (
  requesterRole: CompanyMemberRole,
  targetRole: CompanyMemberRole,
) => {
  // Owner can never be removed
  if (targetRole === CompanyMemberRole.OWNER) {
    throw new AppError(HTTP_STATUS_CODE.FORBIDDEN, 'Owner cannot be removed');
  }

  // OWNER can remove everyone except OWNER
  if (requesterRole === CompanyMemberRole.OWNER) {
    return;
  }

  // ADMIN restrictions
  if (requesterRole === CompanyMemberRole.ADMIN) {
    if (targetRole === CompanyMemberRole.ADMIN) {
      throw new AppError(
        HTTP_STATUS_CODE.FORBIDDEN,
        'Admins cannot remove another admin',
      );
    }

    return;
  }

  throw new AppError(
    HTTP_STATUS_CODE.FORBIDDEN,
    'You do not have permission to remove members',
  );
};
