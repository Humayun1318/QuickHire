import httpStatus from 'http-status-codes';
import { Resume } from './resume.models';
import { CreateResumeDTO, IResumeDocument } from './resume.interface';
import {
  DEFAULT_RESUME_NOT_ALLOWED,
  LAST_RESUME_CANNOT_BE_DELETED,
  MAX_RESUMES_PER_USER,
  MAX_RESUMES_REACHED,
  RESUME_NOT_FOUND,
} from './resume.constants';
import AppError from '../../errorHelpers/AppError';
// ─────────────────────────────────────────────────────────────
// Create — seeker only (route guard + userId pin)
// Rules:
//  - Resume is pinned to the authenticated user (userId cannot be spoofed)
//  - A user can have at most MAX_RESUMES_PER_USER active resumes
//  - First resume is made default automatically
// ─────────────────────────────────────────────────────────────
const createResume = async (
  userId: string,
  payload: CreateResumeDTO,
): Promise<IResumeDocument> => {
  const activeCount = await Resume.countOwnedByUser(userId);
  if (activeCount >= MAX_RESUMES_PER_USER) {
    throw new AppError(httpStatus.BAD_REQUEST, MAX_RESUMES_REACHED);
  }
  const resume = await Resume.create({
    ...payload,
    userId,
    // First resume becomes the default — a user always has a default
    isDefault: activeCount === 0,
  });
  return resume;
};
// ─────────────────────────────────────────────────────────────
// Get my resumes — seeker's own list, newest first
// ─────────────────────────────────────────────────────────────
const getMyResumes = async (userId: string) => {
  return Resume.find({ userId, isActive: true })
    .sort({ isDefault: -1, createdAt: -1 })
    .lean();
};
// ─────────────────────────────────────────────────────────────
// Get single resume — must belong to the requesting user
// ─────────────────────────────────────────────────────────────
const getResumeById = async (
  resumeId: string,
  userId: string,
): Promise<IResumeDocument | null> => {
  const resume = await Resume.isOwnedByUser(resumeId, userId);
  if (!resume) {
    throw new AppError(httpStatus.NOT_FOUND, RESUME_NOT_FOUND);
  }
  return resume;
};
// ─────────────────────────────────────────────────────────────
// Update own resume — title / file URL only
// isDefault, downloadCount, userId are managed elsewhere
// ─────────────────────────────────────────────────────────────
const updateResume = async (
  resumeId: string,
  userId: string,
  payload: Partial<CreateResumeDTO>,
): Promise<IResumeDocument> => {
  const resume = await Resume.isOwnedByUser(resumeId, userId);
  if (!resume) {
    throw new AppError(httpStatus.NOT_FOUND, RESUME_NOT_FOUND);
  }
  const updated = await Resume.findByIdAndUpdate(
    resumeId,
    { $set: payload },
    { new: true, runValidators: true },
  );
  return updated!;
};
// ─────────────────────────────────────────────────────────────
// Delete own resume — soft delete
// Rules:
//  - Only the owner can delete
//  - A user must keep at least one resume (applications reference it)
//  - If the deleted resume is the default, promote the newest one
// ─────────────────────────────────────────────────────────────
const deleteResume = async (
  resumeId: string,
  userId: string,
): Promise<{ message: string }> => {
  const resume = await Resume.isOwnedByUser(resumeId, userId);
  if (!resume) {
    throw new AppError(httpStatus.NOT_FOUND, RESUME_NOT_FOUND);
  }
  const activeCount = await Resume.countOwnedByUser(userId);
  if (activeCount <= 1) {
    throw new AppError(httpStatus.BAD_REQUEST, LAST_RESUME_CANNOT_BE_DELETED);
  }
  const wasDefault = resume.isDefault;
  // Soft delete — applications keep referencing this resume
  await Resume.findByIdAndUpdate(resumeId, { $set: { isActive: false } });
  // Promote a new default if needed
  if (wasDefault) {
    const fallback = await Resume.findOne({ userId, isActive: true }).sort({
      createdAt: -1,
    });
    if (fallback) {
      fallback.isDefault = true;
      await fallback.save();
    }
  }
  return { message: 'Resume deleted successfully' };
};
// ─────────────────────────────────────────────────────────────
// Set default resume — seeker picks which resume to send
// when applying (resumeId is carried on the application)
// Rules:
//  - Only the owner can change the default
//  - Only an active resume can be the default
// ─────────────────────────────────────────────────────────────
const setDefaultResume = async (
  resumeId: string,
  userId: string,
): Promise<IResumeDocument> => {
  const resume = await Resume.isOwnedByUser(resumeId, userId);
  if (!resume) {
    throw new AppError(httpStatus.NOT_FOUND, RESUME_NOT_FOUND);
  }
  if (resume.isDefault) {
    return resume;
  }
  if (!resume.isActive) {
    throw new AppError(httpStatus.BAD_REQUEST, DEFAULT_RESUME_NOT_ALLOWED);
  }
  // Clear default on every other active resume — atomic per-user
  await Resume.clearDefaults(userId, resumeId);
  resume.isDefault = true;
  await resume.save();
  return resume;
};
// ─────────────────────────────────────────────────────────────
// Internal — called by application service
// Increment download counter when an employer views the resume
// ─────────────────────────────────────────────────────────────
const incrementDownloadCount = async (resumeId: string) => {
  await Resume.findByIdAndUpdate(resumeId, {
    $inc: { downloadCount: 1 },
  });
};
export const resumeService = {
  createResume,
  getMyResumes,
  getResumeById,
  updateResume,
  deleteResume,
  setDefaultResume,
  incrementDownloadCount,
};
