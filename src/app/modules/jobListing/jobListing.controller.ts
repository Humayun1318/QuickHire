import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';
import { sendResponse }        from '../../utils/sendResponse';
import { jobListingService }   from './jobListing.service';
import {
  IJobListingQuery,
} from './jobListing.interface';
import { JobStatus } from './jobListing.constants';
import catchAsync from '../../utils/catchAsync';
import { getUserIdFromReq } from '../../utils/getUserIdFromReq';

// POST /jobs
// Body must include companyId — the member selects which company they're posting for
const createJob = catchAsync(async (req: Request, res: Response) => {
  const { companyId, ...payload } = req.body;
  const result = await jobListingService.createJob(
    getUserIdFromReq(req),
    companyId,
    payload,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success:    true,
    message:    'Job listing created successfully',
    data:       result,
  });
});

// GET /jobs?searchTerm=react&type=full-time&city=dhaka&page=1&limit=20
const searchJobs = catchAsync(async (req: Request, res: Response) => {
  const result = await jobListingService.searchJobs(
    req.query as unknown as IJobListingQuery,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success:    true,
    message:    'Jobs retrieved successfully',
    data:       result.jobs,
    // meta:       result.meta,
  });
});

// GET /jobs/slug/:slug
const getJobBySlug = catchAsync(async (req: Request, res: Response) => {
  const result = await jobListingService.getJobBySlug(req.params.slug);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success:    true,
    message:    'Job retrieved successfully',
    data:       result,
  });
});

// GET /jobs/:jobId
const getJobById = catchAsync(async (req: Request, res: Response) => {
  const result = await jobListingService.getJobById(req.params.jobId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success:    true,
    message:    'Job retrieved successfully',
    data:       result,
  });
});

// GET /companies/:companyId/jobs — employer's own job listings
const getCompanyJobs = catchAsync(async (req: Request, res: Response) => {
  const result = await jobListingService.getCompanyJobs(
    req.params.companyId,
    req.query as unknown as IJobListingQuery,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success:    true,
    message:    'Company jobs retrieved successfully',
    data:       result.jobs,
    // meta:       result.meta,
  });
});

// PATCH /jobs/:jobId
const updateJob = catchAsync(async (req: Request, res: Response) => {
  const { companyId, ...payload } = req.body;
  const result = await jobListingService.updateJob(
    req.params.jobId,
    getUserIdFromReq(req),
    companyId,
    payload,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success:    true,
    message:    'Job updated successfully',
    data:       result,
  });
});

// PATCH /jobs/:jobId/status
const updateJobStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await jobListingService.updateJobStatus(
    req.params.jobId,
    getUserIdFromReq(req),
    req.body.companyId,
    req.body.status as JobStatus,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success:    true,
    message:    'Job status updated successfully',
    data:       result,
  });
});

// DELETE /jobs/:jobId
const deleteJob = catchAsync(async (req: Request, res: Response) => {
  const result = await jobListingService.deleteJob(
    req.params.jobId,
    getUserIdFromReq(req),
    req.body.companyId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success:    true,
    message:    result.message,
    data:       null,
  });
});

// PATCH /jobs/:jobId/featured — admin only
const toggleFeatured = catchAsync(async (req: Request, res: Response) => {
  const result = await jobListingService.toggleFeatured(
    req.params.jobId,
    req.body.isFeatured,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success:    true,
    message:    `Job ${result.isFeatured ? 'featured' : 'unfeatured'} successfully`,
    data:       result,
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