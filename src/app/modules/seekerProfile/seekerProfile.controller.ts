import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';
import { sendResponse } from '../../utils/sendResponse';
import { seekerProfileService } from './seekerProfile.service';
import catchAsync from '../../utils/catchAsync';
import { JwtPayload } from 'jsonwebtoken';

// POST /seeker-profiles
const createSeekerProfile = catchAsync(async (req: Request, res: Response) => {
  // userId comes from decoded JWT — never trust client-supplied userId
  const userId = (req.user as JwtPayload).userId;
  const result = await seekerProfileService.createSeekerProfile(
    userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Seeker profile created successfully',
    data: result,
  });
});

// GET /seeker-profiles/me
const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).userId;
  const result = await seekerProfileService.getMyProfile(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Profile retrieved successfully',
    data: result,
  });
});

// GET /seeker-profiles/:profileId
const getProfileById = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).userId;
  const result = await seekerProfileService.getProfileById(req.params.profileId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Profile retrieved successfully',
    data: result,
  });
});

// PATCH /seeker-profiles/me
const updateSeekerProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).userId;
  const result = await seekerProfileService.updateSeekerProfile(
    userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Profile updated successfully',
    data: result,
  });
});

// DELETE /seeker-profiles/me
const deleteSeekerProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).userId;
  const result = await seekerProfileService.deleteSeekerProfile(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Profile deleted successfully',
    data: result,
  });
});

export const seekerProfileController = {
  createSeekerProfile,
  getMyProfile,
  getProfileById,
  updateSeekerProfile,
  deleteSeekerProfile,
};