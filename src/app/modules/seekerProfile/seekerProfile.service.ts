
import httpStatus from 'http-status-codes';
import {
  SEEKER_PROFILE_ALREADY_EXISTS,
  SEEKER_PROFILE_NOT_FOUND,
} from './seekerProfile.constants';
import { ISeekerProfile } from './seekerProfile.interface';
import { SeekerProfile } from './seekerProfile.models';
import AppError from '../../errorHelpers/AppError';
import mongoose from 'mongoose';

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
    throw new AppError(httpStatus.CONFLICT, SEEKER_PROFILE_ALREADY_EXISTS);
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
    throw new AppError(httpStatus.NOT_FOUND, SEEKER_PROFILE_NOT_FOUND);
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
    throw new AppError(httpStatus.NOT_FOUND, SEEKER_PROFILE_NOT_FOUND);
  }

  return profile;
};

// ─────────────────────────────────────────────────────────────
// Get all active profiles — for employer directory listing
// ─────────────────────────────────────────────────────────────
const getAllProfiles = async (active: boolean = true) => {
  const profiles = await SeekerProfile.find({ isActive: active }).populate('userId', 'name email');
  return profiles;
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
      new: true,         // return updated document
      runValidators: true, // run schema validators on update
    },
  );

  if (!profile) {
    throw new AppError(httpStatus.NOT_FOUND, SEEKER_PROFILE_NOT_FOUND);
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
    throw new AppError(httpStatus.NOT_FOUND, SEEKER_PROFILE_NOT_FOUND);
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
    { new: true, session }
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