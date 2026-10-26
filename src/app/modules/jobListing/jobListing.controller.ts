import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';
import { sendResponse } from '../../utils/sendResponse';
import { jobListingService } from './jobListing.service';
import { ICompanyJobsQuery, IJobListingQuery } from './jobListing.interface';
import catchAsync from '../../utils/catchAsync';
import {
  getUserIdFromReq,
  getUserRoleFromReq,
} from '../../utils/getUserIdFromReq';

const createJob = catchAsync(async (req: Request, res: Response) => {
  const { companyId, ...payload } = req.body;

  const result = await jobListingService.createJob(
    getUserIdFromReq(req),
    companyId,
    payload,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Job listing created successfully',
    data: result,
  });
});

const searchJobs = catchAsync(async (req: Request, res: Response) => {
  const result = await jobListingService.searchJobs(
    req.query as IJobListingQuery,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Jobs retrieved successfully',
    data: result.jobs,
    meta: result.meta,
  });
});

const getJobBySlug = catchAsync(async (req: Request, res: Response) => {
  const result = await jobListingService.getJobBySlug(
    req.params.slug as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job retrieved successfully',
    data: result,
  });
});

const getJobById = catchAsync(async (req: Request, res: Response) => {
  const result = await jobListingService.getJobById(req.params.jobId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job retrieved successfully',
    data: result,
  });
});

const getCompanyJobs = catchAsync(async (req: Request, res: Response) => {
  const result = await jobListingService.getCompanyJobs(
    req.params.companyId as string,
    { userId: getUserIdFromReq(req), role: getUserRoleFromReq(req) },
    req.query as ICompanyJobsQuery,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Company jobs retrieved successfully',
    data: result.jobs,
    meta: result.meta,
  });
});

const updateJob = catchAsync(async (req: Request, res: Response) => {
  // companyId (if sent by older clients) is ignored — the company is
  // derived from the job itself.
  const { companyId: _ignored, ...payload } = req.body;

  const result = await jobListingService.updateJob(
    req.params.jobId as string,
    getUserIdFromReq(req),
    payload,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job updated successfully',
    data: result,
  });
});

const updateJobStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await jobListingService.updateJobStatus(
    req.params.jobId as string,
    getUserIdFromReq(req),
    req.body.status,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job status updated successfully',
    data: result,
  });
});

const deleteJob = catchAsync(async (req: Request, res: Response) => {
  const result = await jobListingService.deleteJob(
    req.params.jobId as string,
    getUserIdFromReq(req),
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

const toggleFeatured = catchAsync(async (req: Request, res: Response) => {
  const result = await jobListingService.toggleFeatured(
    req.params.jobId as string,
    req.body.isFeatured,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Job ${result.isFeatured ? 'featured' : 'unfeatured'} successfully`,
    data: result,
  });
});

export const jobListingController = {
  createJob,
  searchJobs,
  getJobBySlug,
  getJobById,
  getCompanyJobs,
  updateJob,
  updateJobStatus,
  deleteJob,
  toggleFeatured,
};
