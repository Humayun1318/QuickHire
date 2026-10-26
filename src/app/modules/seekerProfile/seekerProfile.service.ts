import {
  SEEKER_PROFILE_ALREADY_EXISTS,
  SEEKER_PROFILE_NOT_FOUND,
} from './seekerProfile.constants';
import { ISeekerProfile } from './seekerProfile.interface';
import { SeekerProfile } from './seekerProfile.models';
import AppError from '../../errorHelpers/AppError';
import mongoose from 'mongoose';
import { HTTP_STATUS_CODE } from '../../utils/HTTP_STATUS_CODE';

// ─────────────────────────────────────────────────────────────
// Create — one profile per user enforced at model (unique) and service layer
// ─────────────────────────────────────────────────────────────

const createSeekerProfile = async (
  userId: string,
  payload: Partial<ISeekerProfile>,
) => {
  // Guard: prevent duplicate profiles (belt-and-suspenders with unique index)
  const existing = await SeekerProfile.isProfileExists(userId);
  if (existing) {
    throw new AppError(
      HTTP_STATUS_CODE.CONFLICT,
      SEEKER_PROFILE_ALREADY_EXISTS,
    );
  }

  // A previously soft-deleted profile still occupies the unique userId index,
  // so creating a new document would fail with a duplicate-key error.
  // Restore it instead, applying the new data on top.
  const restored = await SeekerProfile.findOneAndUpdate(
    { userId, isActive: false },
    { $set: { ...payload, isActive: true } },
    { new: true, runValidators: true },
  );
  if (restored) {
    return restored;
  }

  const profile = await SeekerProfile.create({ ...payload, userId });
  return profile;
};

// ─────────────────────────────────────────────────────────────
// Get own profile — seeker fetching their own profile
// ─────────────────────────────────────────────────────────────

const getMyProfile = async (userId: string) => {
  const profile = await SeekerProfile.findOne({ userId, isActive: true })
    // Populate user fields needed for display — exclude sensitive fields
    .populate('userId', 'name email');

  if (!profile) {
    throw new AppError(HTTP_STATUS_CODE.NOT_FOUND, SEEKER_PROFILE_NOT_FOUND);
  }

  return profile;
};

// ─────────────────────────────────────────────────────────────
// Get public profile by profileId — for employers and job detail pages
// ─────────────────────────────────────────────────────────────

const getProfileById = async (profileId: string, active: boolean = true) => {
  const profile = await SeekerProfile.findOne({
    _id: profileId,
    isActive: active,
  }).populate('userId', 'name email');

  if (!profile) {
    throw new AppError(HTTP_STATUS_CODE.NOT_FOUND, SEEKER_PROFILE_NOT_FOUND);
  }

  return profile;
};

// ─────────────────────────────────────────────────────────────
// Get profiles — paginated employer directory listing
// ─────────────────────────────────────────────────────────────
const getAllProfiles = async (
  active: boolean = true,
  pagination: { page?: unknown; limit?: unknown } = {},
) => {
  const page = Math.max(1, Number(pagination.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(pagination.limit) || 20));
  const filter = { isActive: active };

  const [profiles, total] = await Promise.all([
    SeekerProfile.find(filter)
      .sort({ profileCompleteness: -1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name email'),
    SeekerProfile.countDocuments(filter),
  ]);

  return {
    profiles,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

// ─────────────────────────────────────────────────────────────
// Update — partial update, completeness recalculated via pre hook
// ─────────────────────────────────────────────────────────────

const updateSeekerProfile = async (
  userId: string,
  payload: Partial<ISeekerProfile>,
) => {
  const profile = await SeekerProfile.findOneAndUpdate(
    { userId, isActive: true },
    { $set: payload },
    {
      new: true, // return updated document
      runValidators: true, // run schema validators on update
    },
  );

  if (!profile) {
    throw new AppError(HTTP_STATUS_CODE.NOT_FOUND, SEEKER_PROFILE_NOT_FOUND);
  }

  return profile;
};

// ─────────────────────────────────────────────────────────────
// Soft delete — keeps data intact, just hides from queries
// ─────────────────────────────────────────────────────────────

const deleteSeekerProfile = async (userId: string) => {
  const profile = await SeekerProfile.findOneAndUpdate(
    { userId, isActive: true },
    { $set: { isActive: false } },
    { new: true },
  );

  if (!profile) {
    throw new AppError(HTTP_STATUS_CODE.NOT_FOUND, SEEKER_PROFILE_NOT_FOUND);
  }

  return profile;
};

// ─────────────────────────────────────────────────────────────
// Internal — called by seekerExperience & seekerEducation services
// to bump completeness score when those sub-modules are updated
// ─────────────────────────────────────────────────────────────

const incrementCompleteness = async (
  userId: string,
  points: number,
  session?: mongoose.ClientSession, // Optional session for transaction support
) => {
  await SeekerProfile.findOneAndUpdate(
    { userId },
    { $inc: { profileCompleteness: points } },
    { new: true, session },
  );
};

export const seekerProfileService = {
  createSeekerProfile,
  getMyProfile,
  getProfileById,
  getAllProfiles,
  updateSeekerProfile,
  deleteSeekerProfile,
  incrementCompleteness,
};
