import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { userService } from './user.service';
import { sendResponse } from '../../utils/sendResponse';
import httpStatus from 'http-status-codes';

const createUser = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.createUser(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'User created successfully',
    data: result,
  });
});
const getAllUser = catchAsync(async (req: Request, res: Response) => {});
const getUserById = catchAsync(async (req: Request, res: Response) => {});
const updateUser = catchAsync(async (req: Request, res: Response) => {});
const deleteUser = catchAsync(async (req: Request, res: Response) => {});

export const userController = {
  createUser,
  getAllUser,
  getUserById,
  updateUser,
  deleteUser,
};
