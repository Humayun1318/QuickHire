import AppError from '../../errorHelpers/AppError';
import { HTTP_STATUS_CODE } from '../../utils/HTTP_STATUS_CODE';
import { CompanyMemberRole } from '../companyMember/companyMember.constants';
import { CompanyMember } from '../companyMember/companyMember.models';

export const requireCompanyRole = async (
  companyId: string,
  userId: string,
  allowedRoles: CompanyMemberRole[],
) => {
  const member = await CompanyMember.getMemberWithRole(companyId, userId);

  if (!member) {
    throw new AppError(
      HTTP_STATUS_CODE.FORBIDDEN,
      'You are not a member of this company',
    );
  }

  if (!allowedRoles.includes(member.role)) {
    throw new AppError(
      HTTP_STATUS_CODE.FORBIDDEN,
      'You do not have permission to perform this action',
    );
  }

  return member;
};
