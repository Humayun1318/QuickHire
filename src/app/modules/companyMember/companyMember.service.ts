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

// ─────────────────────────────────────────────────────────────
// Add member — owner or admin can add members
// ─────────────────────────────────────────────────────────────

const addMember = async (
  companyId: string,
  requesterId: string, // the person doing the adding
  targetUserId: string,
  role: CompanyMemberRole,
) => {
  // Verify company exists
  const company = await Company.isCompanyExists(companyId);
  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, COMPANY_NOT_FOUND);
  }

  // Verify requester has permission (must be OWNER or ADMIN of this company)
  const requester = await CompanyMember.getMemberWithRole(companyId, requesterId);
  const canManage = [CompanyMemberRole.OWNER, CompanyMemberRole.ADMIN];
  if (!requester || !canManage.includes(requester.role)) {
    throw new AppError(
      HTTP_STATUS_CODE.FORBIDDEN,
      'Only company OWNER or ADMIN can add members',
    );
  }

  // Verify the target user exists and has employer role
  // Only employer-role users can be company members — seekers cannot
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (targetUser.role !== UserRole.EMPLOYER) {
    throw new AppError(
      HTTP_STATUS_CODE.BAD_REQUEST,
      'Only users with employer role can be added as company members',
    );
  }

  // Prevent duplicate membership
  const alreadyMember = await CompanyMember.isMemberExists(companyId, targetUserId);
  if (alreadyMember) {
    throw new AppError(httpStatus.CONFLICT, MEMBER_ALREADY_EXISTS);
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

const getCompanyMembers = async (companyIdentifier: { companyId?: string; slug?: string }) => {

  let company: ICompanyDocument | null = null;
  if (companyIdentifier.companyId) {
    company = await Company.isCompanyExists(companyIdentifier.companyId);
  } else {
    company = await Company.findOne({ slug: companyIdentifier.slug, isActive: true });
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
  memberId: string, // the _id of the companyMember document
  newRole: CompanyMemberRole,
) => {
  // Find the target member record
  const targetMember = await CompanyMember.findOne({
    _id: memberId,
    companyId,
    isActive: true,
  });
  if (!targetMember) {
    throw new AppError(httpStatus.NOT_FOUND, MEMBER_NOT_FOUND);
  }

  // Guard: owner's role is immutable
  if (targetMember.role === CompanyMemberRole.OWNER) {
    throw new AppError(httpStatus.FORBIDDEN, CANNOT_CHANGE_OWNER_ROLE);
  }

  // Guard: only OWNER or ADMIN can change roles
  const requester = await CompanyMember.getMemberWithRole(companyId, requesterId);
  const canManage = [CompanyMemberRole.OWNER, CompanyMemberRole.ADMIN];
  if (!requester || !canManage.includes(requester.role)) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only company OWNER or ADMIN can update member roles',
    );
  }

  const updated = await CompanyMember.findByIdAndUpdate(
    memberId,
    { $set: { role: newRole } },
    { new: true },
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
  const targetMember = await CompanyMember.findOne({
    _id: memberId,
    companyId,
    isActive: true,
  });
  if (!targetMember) {
    throw new AppError(httpStatus.NOT_FOUND, MEMBER_NOT_FOUND);
  }

  // OWNER cannot be removed — company must be deleted or ownership transferred
  if (targetMember.role === CompanyMemberRole.OWNER) {
    throw new AppError(httpStatus.FORBIDDEN, CANNOT_REMOVE_OWNER);
  }

  // Only OWNER or ADMIN can remove members
  const requester = await CompanyMember.getMemberWithRole(companyId, requesterId);
  const canManage = [CompanyMemberRole.OWNER, CompanyMemberRole.ADMIN];
  if (!requester || !canManage.includes(requester.role)) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only company OWNER or ADMIN can remove members',
    );
  }

  await CompanyMember.findByIdAndUpdate(memberId, {
    $set: { isActive: false },
  });

  return { message: 'Member removed successfully' };
};

// ─────────────────────────────────────────────────────────────
// Leave company — member removes themselves
// Owner cannot leave — they must delete the company or transfer ownership
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
    $set: { isActive: false },
  });

  return { message: 'You have left the company' };
};

export const companyMemberService = {
  addMember,
  getCompanyMembers,
  updateMemberRole,
  removeMember,
  leaveCompany,
};