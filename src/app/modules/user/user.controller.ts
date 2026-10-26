import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { userService } from './user.service';
import { sendResponse } from '../../utils/sendResponse';
import httpStatus from 'http-status-codes';
import { getUserIdFromReq } from '../../utils/getUserIdFromReq';

const getAllUser = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.getAllUser(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Users retrieved successfully',
    data: result.data,
    meta: { ...result.meta },
  });
});

// Current authenticated user (works for cookie-only sessions, e.g. after
// Google login where the frontend never sees the tokens).
const getMe = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.getUserById(getUserIdFromReq(req));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User retrieved successfully',
    data: result,
  });
});

const getUserById = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.getUserById(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User retrieved successfully',
    data: result,
  });
});

export const userController = {
  getAllUser,
  getMe,
  getUserById,
};
