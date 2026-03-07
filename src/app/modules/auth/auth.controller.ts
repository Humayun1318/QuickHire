import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { authService } from './auth.service';
import { sendResponse } from '../../utils/sendResponse';
import httpStatus from 'http-status-codes';

const createAuth = catchAsync(async (req: Request, res: Response) => {
   const result = await authService.createAuth(req.body);
   sendResponse(res, {
     statusCode: httpStatus.OK,
     success: true,
     message: 'Login successfully',
     data: result,
   });
});
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