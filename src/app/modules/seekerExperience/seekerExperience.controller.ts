
import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';
import { sendResponse } from '../../utils/sendResponse';
import { seekerExperienceService } from './seekerExperience.service';
import catchAsync from '../../utils/catchAsync';
import { getUserIdFromReq } from '../../utils/getUserIdFromReq';

const createExperience = catchAsync(async (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const result = await seekerExperienceService.createExperience(
    userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Experience added successfully',
    data: result,
  });
});

const getMyExperiences = catchAsync(async (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const result = await seekerExperienceService.getMyExperiences(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Experience records retrieved successfully',
    data: result,
  });
});

const updateExperience = catchAsync(async (req: Request, res: Response) => {
  const result = await seekerExperienceService.updateExperience(
    req.params.experienceId,
    getUserIdFromReq(req),
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Experience updated successfully',
    data: result,
  });
});

const deleteExperience = catchAsync(async (req: Request, res: Response) => {
  const result = await seekerExperienceService.deleteExperience(
    req.params.experienceId,
    getUserIdFromReq(req),
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Experience deleted successfully',
    data: result,
  });
});

export const seekerExperienceController = {
  createExperience,
  getMyExperiences,
  updateExperience,
  deleteExperience,
};