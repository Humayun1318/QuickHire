import { Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync';
import httpStatus from 'http-status-codes';
import { sendResponse } from '../../utils/sendResponse';
import { jobListingService } from './jobListing.service';

const createJobListing = catchAsync(async (req: Request, res: Response) => {
  const result = await jobListingService.createJobListing(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Job listing created successfully',
    data: result,
  });
});

const getAllJobListing = catchAsync(async (req: Request, res: Response) => {
  const result = await jobListingService.getAllJobListing(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job listings retrieved successfully',
    data: result,
  });
});

const getJobListingById = catchAsync(async (req: Request, res: Response) => {
  const result = await jobListingService.getJobListingById(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job listing retrieved successfully',
    data: result,
  });
});

const updateJobListing = catchAsync(async (req: Request, res: Response) => {
  const result = await jobListingService.updateJobListing(
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job listing updated successfully',
    data: result,
  });
});

const deleteJobListing = catchAsync(async (req: Request, res: Response) => {
  const result = await jobListingService.deleteJobListing(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job listing deleted successfully along with associated applications',
    data: result,
  });
});

export const jobListingController = {
  createJobListing,
  getAllJobListing,
  getJobListingById,
  updateJobListing,
  deleteJobListing,
};
