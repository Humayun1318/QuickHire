import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { authService } from './auth.service';

const createAuth = catchAsync(async (req: Request, res: Response) => {});
const getAllAuth = catchAsync(async (req: Request, res: Response) => {});
const getAuthById = catchAsync(async (req: Request, res: Response) => {});
const updateAuth = catchAsync(async (req: Request, res: Response) => {});
const deleteAuth = catchAsync(async (req: Request, res: Response) => {});

export const authController = {
  createAuth,
  getAllAuth,
  getAuthById,
  updateAuth,
  deleteAuth,
};