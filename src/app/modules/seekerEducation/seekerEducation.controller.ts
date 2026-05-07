import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { seekerEducationService } from './seekerEducation.service';

const createSeekerEducation = catchAsync(async (req: Request, res: Response) => {});
const getAllSeekerEducation = catchAsync(async (req: Request, res: Response) => {});
const getSeekerEducationById = catchAsync(async (req: Request, res: Response) => {});
const updateSeekerEducation = catchAsync(async (req: Request, res: Response) => {});
const deleteSeekerEducation = catchAsync(async (req: Request, res: Response) => {});

export const seekerEducationController = {
  createSeekerEducation,
  getAllSeekerEducation,
  getSeekerEducationById,
  updateSeekerEducation,
  deleteSeekerEducation,
};