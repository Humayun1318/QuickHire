import { Request, Response } from 'express';
import httpStatus from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { getUserIdFromReq } from '../../utils/getUserIdFromReq';
import { applicationService } from './Application.service';
// POST /applications — seeker submits an application
const submitApplication = catchAsync(async (req: Request, res: Response) => {
  const result = await applicationService.submitApplication(
    getUserIdFromReq(req),
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Application submitted successfully',
    data: result,
  });
});
// GET /applications — seeker's own applications
const getMyApplications = catchAsync(async (req: Request, res: Response) => {
  const result = await applicationService.getMyApplications(
    getUserIdFromReq(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Applications retrieved successfully',
    data: result,
  });
});
// PATCH /applications/:applicationId/withdraw — seeker withdraws
const withdrawApplication = catchAsync(async (req: Request, res: Response) => {
  const result = await applicationService.withdrawApplication(
    req.params.applicationId,
    getUserIdFromReq(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Application withdrawn successfully',
    data: result,
  });
});
// PATCH /applications/:applicationId/review — employer reviews
const reviewApplication = catchAsync(async (req: Request, res: Response) => {
  const result = await applicationService.updateEmployerFields(
    req.params.applicationId,
    getUserIdFromReq(req),
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Application updated successfully',
    data: result,
  });
});
// GET /applications/jobs/:jobId — employer lists applications for a job
const getJobApplications = catchAsync(async (req: Request, res: Response) => {
  const result = await applicationService.getJobApplications(
    req.params.jobId,
    getUserIdFromReq(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Applications retrieved successfully',
    data: result,
  });
});
// GET /applications/:applicationId — admin retrieves a single application
const getApplicationById = catchAsync(async (req: Request, res: Response) => {
  const result = await applicationService.getApplicationById(
    req.params.applicationId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Application retrieved successfully',
    data: result,
  });
});
export const applicationController = {
  submitApplication,
  getMyApplications,
  withdrawApplication,
  reviewApplication,
  getJobApplications,
  getApplicationById,
};
