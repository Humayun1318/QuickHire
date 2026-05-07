import httpStatus from 'http-status-codes';
import {
  EDUCATION_COMPLETENESS_POINTS,
  EDUCATION_NOT_FOUND,
  EDUCATION_NOT_OWNED,
} from './seekerEducation.constants';
import { ISeekerEducation } from './seekerEducation.interface';
import { SeekerEducation } from './seekerEducation.models';
import { SeekerProfile } from '../seekerProfile/seekerProfile.models';
import AppError from '../../errorHelpers/AppError';

const createEducation = async (
  userId: string,
  payload: Partial<ISeekerEducation>,
) => {
  // Fetch the profile to get profileId — also validates that profile exists
  const profile = await SeekerProfile.isProfileExists(userId);
  if (!profile) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Seeker profile not found. Please create a profile first.',
    );
  }

  const isFirst = (await SeekerEducation.countDocuments({ userId })) === 0;

  const education = await SeekerEducation.create({
    ...payload,
    userId,
    profileId: profile._id,
  });

  // Bump completeness score only on first education entry —
  // subsequent entries don't add more points (field is already "filled")
  if (isFirst) {
    await SeekerProfile.findByIdAndUpdate(profile._id, {
      $inc: { profileCompleteness: EDUCATION_COMPLETENESS_POINTS },
    });
  }

  return education;
};

const getMyEducations = async (userId: string) => {
  return SeekerEducation.find({ userId }).sort({ startDate: -1 });
};

const updateEducation = async (
  educationId: string,
  userId: string,
  payload: Partial<ISeekerEducation>,
) => {
  // Ownership check before update — prevents users editing others' records
  const education = await SeekerEducation.isOwnedByUser(educationId, userId);
  if (!education) {
    throw new AppError(httpStatus.FORBIDDEN, EDUCATION_NOT_OWNED);
  }

  const updated = await SeekerEducation.findByIdAndUpdate(
    educationId,
    { $set: payload },
    { new: true, runValidators: true },
  );

  if (!updated) {
    throw new AppError(httpStatus.NOT_FOUND, EDUCATION_NOT_FOUND);
  }

  return updated;
};

const deleteEducation = async (educationId: string, userId: string) => {
  const education = await SeekerEducation.isOwnedByUser(educationId, userId);
  if (!education) {
    throw new AppError(httpStatus.FORBIDDEN, EDUCATION_NOT_OWNED);
  }

  await SeekerEducation.findByIdAndDelete(educationId);
  return { message: 'Education record deleted' };
};

export const seekerEducationService = {
  createEducation,
  getMyEducations,
  updateEducation,
  deleteEducation,
};