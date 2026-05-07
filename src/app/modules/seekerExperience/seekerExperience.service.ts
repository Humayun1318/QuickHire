
import httpStatus from 'http-status-codes';

import {
  EXPERIENCE_COMPLETENESS_POINTS,
  EXPERIENCE_NOT_FOUND,
  EXPERIENCE_NOT_OWNED,
} from './seekerExperience.constants';
import { ISeekerExperience } from './seekerExperience.interface';
import { SeekerExperience } from './seekerExperience.models';
import { SeekerProfile } from '../seekerProfile/seekerProfile.models';
import AppError from '../../errorHelpers/AppError';
import { seekerProfileService } from '../seekerProfile/seekerProfile.service';

const createExperience = async (
  userId: string,
  payload: Partial<ISeekerExperience>,
) => {
  const profile = await SeekerProfile.isProfileExists(userId);
  if (!profile) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Seeker profile not found. Please create a profile first.',
    );
  }

  const isFirst = (await SeekerExperience.countDocuments({ userId })) === 0;

  console.log('Creating experience for userId:', isFirst, userId);

  const experience = await SeekerExperience.create({
    ...payload,
    userId,
    profileId: profile._id,
  });

  // Bump profile completeness only on first experience — consistent with education logic
  if (isFirst) {
    // await SeekerProfile.findByIdAndUpdate(profile._id, {
    //   $inc: { profileCompleteness: EXPERIENCE_COMPLETENESS_POINTS },
    // });
    console.log('Incrementing profile completeness for userId:', userId);
     
    seekerProfileService.incrementCompleteness(userId, EXPERIENCE_COMPLETENESS_POINTS);
  }

  return experience;
};

const getMyExperiences = async (userId: string) => {
  // Sort newest first — most relevant experience appears at top
  return SeekerExperience.find({ userId }).sort({ startDate: -1 });
};

const updateExperience = async (
  experienceId: string,
  userId: string,
  payload: Partial<ISeekerExperience>,
) => {
  const experience = await SeekerExperience.isOwnedByUser(experienceId, userId);
  if (!experience) {
    throw new AppError(httpStatus.FORBIDDEN, EXPERIENCE_NOT_OWNED);
  }

  const updated = await SeekerExperience.findByIdAndUpdate(
    experienceId,
    { $set: payload },
    { new: true, runValidators: true },
  );

  if (!updated) {
    throw new AppError(httpStatus.NOT_FOUND, EXPERIENCE_NOT_FOUND);
  }

  return updated;
};

const deleteExperience = async (experienceId: string, userId: string) => {
  const experience = await SeekerExperience.isOwnedByUser(experienceId, userId);
  if (!experience) {
    throw new AppError(httpStatus.FORBIDDEN, EXPERIENCE_NOT_OWNED);
  }

  await SeekerExperience.findByIdAndDelete(experienceId);
  return { message: 'Experience record deleted' };
};

export const seekerExperienceService = {
  createExperience,
  getMyExperiences,
  updateExperience,
  deleteExperience,
};