import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { userService } from './user.service';
import { sendResponse } from '../../utils/sendResponse';
import httpStatus from 'http-status-codes';

const createUser = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.createUser(req.body);

  // Send success response to client with created user data
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'User created successfully',
    data: result,
  });
});

const getAllUser = catchAsync(async (req: Request, res: Response) => {
  // Call service layer to fetch all users from database
  const result = await userService.getAllUser();

  // Send success response with users data
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Users retrieved successfully',
    data: result,
  });
});

const getUserById = catchAsync(async (req: Request, res: Response) => {
  // TODO: Implement get user by ID logic
});

const updateUser = catchAsync(async (req: Request, res: Response) => {
  // TODO: Implement update user logic
});


const deleteUser = catchAsync(async (req: Request, res: Response) => {
  // TODO: Implement delete user logic
});

export const userController = {
  createUser,
  getAllUser,
  getUserById,
  updateUser,
  deleteUser,
};
