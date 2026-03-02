import { Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync';
import httpStatus from 'http-status-codes';
import { sendResponse } from '../../utils/sendResponse';
import { applicationService } from './Application.service';

const submitApplication = catchAsync(async (req: Request, res: Response) => {
  const result = await applicationService.submitApplication(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Application submitted successfully',
    data: result,
  });
});

const getApplicationsByJobId = catchAsync(
  async (req: Request, res: Response) => {
    const result = await applicationService.getApplicationsByJobId(
      req.params.jobId,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Applications retrieved successfully',
      data: result,
    });
  },
);

const getApplicationById = catchAsync(async (req: Request, res: Response) => {
  const result = await applicationService.getApplicationById(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Application retrieved successfully',
    data: result,
  });
});

const deleteApplication = catchAsync(async (req: Request, res: Response) => {
  const result = await applicationService.deleteApplication(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Application deleted successfully',
    data: result,
  });
});

export const applicationController = {
  submitApplication,
  getApplicationsByJobId,
  getApplicationById,
  deleteApplication,
};
