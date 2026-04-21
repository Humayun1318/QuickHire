/**
 * @file jobListing.controller.ts
 * @description Job listing management controller
 * Handles all job listing CRUD operations and sends standardized responses
 */

import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import httpStatus from 'http-status-codes';
import { sendResponse } from '../../utils/sendResponse';
import { jobListingService } from './jobListing.service';

/**
 * Create a new job listing
 * HTTP Method: POST
 * Route: /api/v1/jobs
 *
 * Process:
 * 1. Receive job listing data from request body
 * 2. Validate data using Zod schema (via middleware)
 * 3. Call service to create job listing in database
 * 4. Return created job listing with 201 status
 *
 * @param {Request} req - Request with job listing data in req.body
 * @param {Response} res - Response object
 *
 * Response Status: 201 Created
 */
const createJobListing = catchAsync(async (req: Request, res: Response) => {
  // Call service to create job listing
  const result = await jobListingService.createJobListing(req.body);

  // Send success response
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Job listing created successfully',
    data: result,
  });
});

/**
 * Retrieve all job listings
 * HTTP Method: GET
 * Route: /api/v1/jobs
 *
 * Features:
 * - Supports query parameters for filtering, searching, pagination
 * - Example: /api/v1/jobs?page=1&limit=10&search=developer
 *
 * @param {Request} req - Request with optional query parameters
 * @param {Response} res - Response object
 *
 * Response Status: 200 OK
 */
const getAllJobListing = catchAsync(async (req: Request, res: Response) => {
  // Call service with query parameters for filtering and pagination
  const result = await jobListingService.getAllJobListing(req.query);

  // Send success response with job listings array
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job listings retrieved successfully',
    data: result,
  });
});

/**
 * Retrieve a specific job listing by ID
 * HTTP Method: GET
 * Route: /api/v1/jobs/:id
 *
 * @param {Request} req - Request with job ID in req.params.id
 * @param {Response} res - Response object
 *
 * Response Status: 200 OK
 * Returns: Single job listing object
 */
const getJobListingById = catchAsync(async (req: Request, res: Response) => {
  // Call service to fetch job listing by ID
  const result = await jobListingService.getJobListingById(req.params.id);

  // Send success response with job listing data
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job listing retrieved successfully',
    data: result,
  });
});

/**
 * Update an existing job listing
 * HTTP Method: PATCH or PUT
 * Route: /api/v1/jobs/:id
 *
 * @param {Request} req - Request with:
 *                       - Job ID in req.params.id
 *                       - Updated data in req.body
 * @param {Response} res - Response object
 *
 * Response Status: 200 OK
 * Returns: Updated job listing object
 */
const updateJobListing = catchAsync(async (req: Request, res: Response) => {
  // Call service to update job listing
  const result = await jobListingService.updateJobListing(
    req.params.id,
    req.body,
  );

  // Send success response with updated job listing
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job listing updated successfully',
    data: result,
  });
});

/**
 * Delete a job listing
 * HTTP Method: DELETE
 * Route: /api/v1/jobs/:id
 *
 * Important: When a job is deleted, all associated applications are also deleted
 * This maintains referential integrity in the database
 *
 * @param {Request} req - Request with job ID in req.params.id
 * @param {Response} res - Response object
 *
 * Response Status: 200 OK
 */
const deleteJobListing = catchAsync(async (req: Request, res: Response) => {
  // Call service to delete job listing and associated applications
  const result = await jobListingService.deleteJobListing(req.params.id);

  // Send success response
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message:
      'Job listing deleted successfully along with associated applications',
    data: result,
  });
});

/**
 * Job listing controller object
 * Exports all job listing controller functions for use in routes
 */
export const jobListingController = {
  createJobListing,
  getAllJobListing,
  getJobListingById,
  updateJobListing,
  deleteJobListing,
};
