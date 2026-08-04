import httpStatus from 'http-status-codes';
import {
  CANNOT_CHANGE_OWNER_ROLE,
  CANNOT_REMOVE_OWNER,
  MEMBER_ALREADY_EXISTS,
  MEMBER_NOT_FOUND,
  OWNER_CANNOT_LEAVE,
  CompanyMemberRole,
} from './companyMember.constants';
import { CompanyMember } from './companyMember.models';
import { Company } from '../company/company.models';
import { COMPANY_NOT_FOUND } from '../company/company.constants';
import { User } from '../user/user.models';
import AppError from '../../errorHelpers/AppError';
import { HTTP_STATUS_CODE } from '../../utils/HTTP_STATUS_CODE';
import { UserRole } from '../user/user.interface';
import { ICompanyDocument } from '../company/company.interface';
import { requireCompanyRole } from '../company/company.authorization';
import {
  validateMemberRemovalPermission,
  validateRoleAssignPermission,
  validateRoleUpdatePermission,
} from './companyMember.utils';
import { Types } from 'mongoose';
import { CompanyMemberStatus } from './companyMember.interface';

// ─────────────────────────────────────────────────────────────
// Add member — owner or admin can add members
// ─────────────────────────────────────────────────────────────
const addMember = async (
  companyId: string,
  requesterId: string,
  targetUserId: string,
  role: CompanyMemberRole,
) => {
  // Verify company exists
  const company = await Company.isCompanyExists(companyId);
  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, COMPANY_NOT_FOUND);
  }

  // Verify requester permission
  const requester = await requireCompanyRole(companyId, requesterId, [
    CompanyMemberRole.OWNER,
    CompanyMemberRole.ADMIN,
  ]);

  // Prevent self-add
  if (requesterId === targetUserId) {
    throw new AppError(
      HTTP_STATUS_CODE.BAD_REQUEST,
      'You cannot add yourself as a company member',
    );
  }

  // Role hierarchy validation
  validateRoleAssignPermission(requester.role, role);

  // Verify target user exists
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Only employers can be company members
  if (targetUser.role !== UserRole.EMPLOYER) {
    throw new AppError(
      HTTP_STATUS_CODE.BAD_REQUEST,
      'Only users with employer role can be added as company members',
    );
  }

  // Prevent duplicate membership
  // Check existing membership (active or inactive)
  const existingMember = await CompanyMember.findOne({
    companyId,
    userId: targetUserId,
  });

  // Already an active member
  if (existingMember?.isActive) {
    throw new AppError(httpStatus.CONFLICT, MEMBER_ALREADY_EXISTS);
  }

  // Reactivate previous member
  if (existingMember && !existingMember.isActive) {
    existingMember.isActive = true;
    existingMember.status = CompanyMemberStatus.ACTIVE; // Reset status to active
    existingMember.role = role;
    existingMember.invitedBy = new Types.ObjectId(requesterId);
    existingMember.joinedAt = new Date();

    await existingMember.save();

    return existingMember.populate([
      { path: 'userId', select: 'name email avatar' },
      { path: 'invitedBy', select: 'name email' },
    ]);
  }

  const member = await CompanyMember.create({
    companyId,
    userId: targetUserId,
    role,
    invitedBy: requesterId,
  });

  return member.populate([
    { path: 'userId', select: 'name email avatar' },
    { path: 'invitedBy', select: 'name email' },
  ]);
};
// ─────────────────────────────────────────────────────────────
// Get all members of a company
// ─────────────────────────────────────────────────────────────
const getCompanyMembers = async (companyIdentifier: {
  companyId?: string;
  slug?: string;
}) => {
  let company: ICompanyDocument | null = null;
  if (companyIdentifier.companyId) {
    company = await Company.isCompanyExists(companyIdentifier.companyId);
  } else {
    company = await Company.findOne({
      slug: companyIdentifier.slug,
      isActive: true,
    });
  }
  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, COMPANY_NOT_FOUND);
  }

  return CompanyMember.find({ companyId: company._id, isActive: true })
    .populate('userId', 'name email avatar phone')
    .populate('invitedBy', 'name email')
    .sort({ createdAt: 1 }); // oldest member first — owner always at top
};

// ─────────────────────────────────────────────────────────────
// Update member role — OWNER and ADMIN can change roles
// Cannot change the OWNER's role — ownership transfer is separate
// ─────────────────────────────────────────────────────────────
const updateMemberRole = async (
  companyId: string,
  requesterId: string,
  memberId: string,
  newRole: CompanyMemberRole,
) => {
  // Verify company exists
  const company = await Company.isCompanyExists(companyId);
  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, COMPANY_NOT_FOUND);
  }

  // Verify requester permission
  const requester = await requireCompanyRole(companyId, requesterId, [
    CompanyMemberRole.OWNER,
    CompanyMemberRole.ADMIN,
  ]);

  // Find target member
  const targetMember = await CompanyMember.findOne({
    _id: memberId,
    companyId,
    isActive: true,
  });

  if (!targetMember) {
    throw new AppError(httpStatus.NOT_FOUND, MEMBER_NOT_FOUND);
  }

  // Prevent updating own role
  if (targetMember.userId.toString() === requesterId) {
    throw new AppError(
      HTTP_STATUS_CODE.BAD_REQUEST,
      'You cannot change your own role',
    );
  }

  // Role hierarchy validation
  validateRoleUpdatePermission(requester.role, targetMember.role, newRole);

  const updated = await CompanyMember.findByIdAndUpdate(
    memberId,
    {
      $set: {
        role: newRole,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  ).populate('userId', 'name email avatar');

  return updated;
};
// ─────────────────────────────────────────────────────────────
// Remove member — soft delete, preserves history
// ─────────────────────────────────────────────────────────────
const removeMember = async (
  companyId: string,
  requesterId: string,
  memberId: string,
) => {
  // Company exists
  const company = await Company.isCompanyExists(companyId);

  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, COMPANY_NOT_FOUND);
  }

  // Requester permission
  const requester = await requireCompanyRole(companyId, requesterId, [
    CompanyMemberRole.OWNER,
    CompanyMemberRole.ADMIN,
  ]);

  // Target member
  const targetMember = await CompanyMember.findOne({
    _id: memberId,
    companyId,
    isActive: true,
  });

  if (!targetMember) {
    throw new AppError(httpStatus.NOT_FOUND, MEMBER_NOT_FOUND);
  }

  // Cannot remove yourself
  if (targetMember.userId.toString() === requesterId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You cannot remove yourself. Use the leave company option instead.',
    );
  }

  // Reuse hierarchy helper
  validateMemberRemovalPermission(requester.role, targetMember.role);

  await CompanyMember.findByIdAndUpdate(memberId, {
    $set: {
      isActive: false,
      status: CompanyMemberStatus.REMOVED,
    },
  });

  return {
    message: 'Member removed successfully',
  };
};

// ─────────────────────────────────────────────────────────────
// Leave company — member removes themselves
// Owner cannot leave — they must delete the company
// ─────────────────────────────────────────────────────────────

const leaveCompany = async (companyId: string, userId: string) => {
  const member = await CompanyMember.getMemberWithRole(companyId, userId);

  if (!member) {
    throw new AppError(httpStatus.NOT_FOUND, MEMBER_NOT_FOUND);
  }

  if (member.role === CompanyMemberRole.OWNER) {
    throw new AppError(httpStatus.FORBIDDEN, OWNER_CANNOT_LEAVE);
  }

  await CompanyMember.findByIdAndUpdate(member._id, {
    $set: {
      isActive: false,
      status: CompanyMemberStatus.LEFT,
    },
  });

  return {
    message: 'You have left the company successfully',
  };
};

export const companyMemberService = {
  addMember,
  getCompanyMembers,
  updateMemberRole,
  removeMember,
  leaveCompany,
};
