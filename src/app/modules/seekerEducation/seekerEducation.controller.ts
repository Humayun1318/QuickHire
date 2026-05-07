
import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';
import { sendResponse } from '../../utils/sendResponse';
import { seekerEducationService } from './seekerEducation.service';
import catchAsync from '../../utils/catchAsync';
import { getUserIdFromReq } from '../../utils/getUserIdFromReq';

const createEducation = catchAsync(async (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const result = await seekerEducationService.createEducation(
    userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Education added successfully',
    data: result,
  });
});

const getMyEducations = catchAsync(async (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const result = await seekerEducationService.getMyEducations(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Education records retrieved successfully',
    data: result,
  });
});

const updateEducation = catchAsync(async (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const result = await seekerEducationService.updateEducation(
    req.params.educationId,
    userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Education updated successfully',
    data: result,
  });
});

const deleteEducation = catchAsync(async (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const result = await seekerEducationService.deleteEducation(
    req.params.educationId,
    userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Education deleted successfully',
    data: result,
  });
});

export const seekerEducationController = {
  createEducation,
  getMyEducations,
  updateEducation,
  deleteEducation,
};