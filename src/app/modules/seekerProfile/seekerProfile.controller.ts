import { Request, Response } from 'express';
import { sendResponse } from '../../utils/sendResponse';
import { seekerProfileService } from './seekerProfile.service';
import catchAsync from '../../utils/catchAsync';
import { parseBoolean } from '../user/parseBoolean';
import {
  getUserIdFromReq,
  getUserRoleFromReq,
} from '../../utils/getUserIdFromReq';
import { HTTP_STATUS_CODE } from '../../utils/HTTP_STATUS_CODE';
import { UserRole } from '../user/user.interface';

// POST /seeker-profiles
const createSeekerProfile = catchAsync(async (req: Request, res: Response) => {
  // userId comes from decoded JWT — never trust client-supplied userId
  const userId = getUserIdFromReq(req);
  const result = await seekerProfileService.createSeekerProfile(
    userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: HTTP_STATUS_CODE.CREATED,
    success: true,
    message: 'Seeker profile created successfully',
    data: result,
  });
});

// GET /seeker-profiles/me
const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const result = await seekerProfileService.getMyProfile(userId);

  sendResponse(res, {
    statusCode: HTTP_STATUS_CODE.OK,
    success: true,
    message: 'Profile retrieved successfully',
    data: result,
  });
});

// GET /seeker-profiles?profileId=12345   (single profile)
// GET /seeker-profiles?page=1&limit=20   (paginated list)
const getProfileById = catchAsync(async (req: Request, res: Response) => {
  // Only platform admins may look at soft-deleted (inactive) profiles.
  const isPlatformAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(
    getUserRoleFromReq(req) as UserRole,
  );
  const requestedActive = parseBoolean(req.query.active as string);
  const active = isPlatformAdmin ? (requestedActive ?? true) : true;

  if (req.query.profileId) {
    const result = await seekerProfileService.getProfileById(
      req.query.profileId as string,
      active,
    );

    sendResponse(res, {
      statusCode: HTTP_STATUS_CODE.OK,
      success: true,
      message: 'Profile retrieved successfully',
      data: result,
    });
    return;
  }

  const result = await seekerProfileService.getAllProfiles(active, {
    page: req.query.page,
    limit: req.query.limit,
  });

  sendResponse(res, {
    statusCode: HTTP_STATUS_CODE.OK,
    success: true,
    message: 'Profiles retrieved successfully',
    data: result.profiles,
    meta: result.meta,
  });
});

// PATCH /seeker-profiles/me
const updateSeekerProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const result = await seekerProfileService.updateSeekerProfile(
    userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: HTTP_STATUS_CODE.OK,
    success: true,
    message: 'Profile updated successfully',
    data: result,
  });
});

// DELETE /seeker-profiles/me
const deleteSeekerProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const result = await seekerProfileService.deleteSeekerProfile(userId);

  sendResponse(res, {
    statusCode: HTTP_STATUS_CODE.OK,
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
