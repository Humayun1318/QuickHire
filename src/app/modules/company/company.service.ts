
import {
  COMPANY_ALREADY_EXISTS,
  COMPANY_NOT_FOUND,
  CompanyVerificationStatus,
} from './company.constants';
import { ICompany } from './company.interface';
import { Company } from './company.models';
import AppError from '../../errorHelpers/AppError';
import { CompanyMemberRole } from '../companyMember/companyMember.constants';
import { CompanyMember } from '../companyMember/companyMember.models';
import { HTTP_STATUS_CODE } from '../../utils/HTTP_STATUS_CODE';
import mongoose from 'mongoose';


// ─────────────────────────────────────────────────────────────
// Create — one company per employer
// Atomically creates company + OWNER member record in the same operation
// ─────────────────────────────────────────────────────────────
const createCompany = async (
  ownerId: string,
  payload: Partial<ICompany>,
) => {

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Guard: one employer → one company (belt-and-suspenders with unique index)
    const existing = await Company.hasExistingCompany(ownerId);
    if (existing) {
      throw new AppError(HTTP_STATUS_CODE.CONFLICT, COMPANY_ALREADY_EXISTS);
    }

    // Create the company
    const [company] = await Company.create(
      [{ ...payload, ownerId }],
      { session },
    );

    // Immediately create the OWNER member record so every company
    // has at least one member from the start.
    // This keeps member-based permission checks consistent —
    // the owner is always findable in the companyMembers collection.
    await CompanyMember.create(
      [
        {
          companyId: company._id,
          userId: ownerId,
          role: CompanyMemberRole.OWNER,
        },
      ],
      { session },
    );

    await session.commitTransaction();
    return company;

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────
// Get own company — employer fetching their own company
// ─────────────────────────────────────────────────────────────

const getMyCompany = async (ownerId: string) => {
  const company = await Company.findOne({ ownerId, isActive: true })
    .populate('ownerId', 'name email avatar');

  if (!company) {
    throw new AppError(HTTP_STATUS_CODE.NOT_FOUND, COMPANY_NOT_FOUND);
  }

  return company;
};

// ─────────────────────────────────────────────────────────────
// Get public company profile — for job seekers browsing companies
// ─────────────────────────────────────────────────────────────

const getCompanyById = async (companyId: string) => {
  const company = await Company.findOne({
    _id: companyId,
    isActive: true,
  }).populate('ownerId', 'name avatar');

  if (!company) {
    throw new AppError(HTTP_STATUS_CODE.NOT_FOUND, COMPANY_NOT_FOUND);
  }

  return company;
};

// Get by slug — used for public company page URLs (/companies/techcorp-ltd)
const getCompanyBySlug = async (slug: string) => {
  const company = await Company.findOne({ slug, isActive: true });

  if (!company) {
    throw new AppError(HTTP_STATUS_CODE.NOT_FOUND, COMPANY_NOT_FOUND);
  }

  return company;
};

// ─────────────────────────────────────────────────────────────
// Update — employer can only update their own company
// ─────────────────────────────────────────────────────────────

const updateCompany = async (
  companyId: string,
  ownerId: string,
  payload: Partial<ICompany>,
) => {
  // Ownership check before update
  const owned = await Company.isOwnedByUser(companyId, ownerId);
  if (!owned) {
    throw new AppError(
      HTTP_STATUS_CODE.FORBIDDEN,
      'You do not have permission to update this company',
    );
  }

  const updated = await Company.findByIdAndUpdate(
    companyId,
    { $set: payload },
    { new: true, runValidators: true },
  );

  if (!updated) {
    throw new AppError(HTTP_STATUS_CODE.NOT_FOUND, COMPANY_NOT_FOUND);
  }

  return updated;
};

// ─────────────────────────────────────────────────────────────
// Soft delete — keeps historical job/application data intact
// ─────────────────────────────────────────────────────────────

const deleteCompany = async (companyId: string, ownerId: string) => {
  const owned = await Company.isOwnedByUser(companyId, ownerId);
  if (!owned) {
    throw new AppError(
      HTTP_STATUS_CODE.FORBIDDEN,
      'You do not have permission to delete this company',
    );
  }

  await Company.findByIdAndUpdate(companyId, { $set: { isActive: false } });
  return { message: 'Company deleted successfully' };
};

// ─────────────────────────────────────────────────────────────
// Admin — update verification status
// ─────────────────────────────────────────────────────────────

const updateVerificationStatus = async (
  companyId: string,
  verificationStatus: CompanyVerificationStatus,
  verificationNote?: string,
) => {
  const company = await Company.findByIdAndUpdate(
    companyId,
    { $set: { verificationStatus, verificationNote } },
    { new: true },
  );

  if (!company) {
    throw new AppError(HTTP_STATUS_CODE.NOT_FOUND, COMPANY_NOT_FOUND);
  }

  return company;
};

export const companyService = {
  createCompany,
  getMyCompany,
  getCompanyById,
  getCompanyBySlug,
  updateCompany,
  deleteCompany,
  updateVerificationStatus,
};