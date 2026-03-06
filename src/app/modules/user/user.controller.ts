import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { userService } from './user.service';

const createUser = catchAsync(async (req: Request, res: Response) => {});
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