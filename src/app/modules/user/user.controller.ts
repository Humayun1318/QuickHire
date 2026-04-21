/**
 * @file user.controller.ts
 * @description User management controller
 * Handles all user-related HTTP requests and responses
 * Routes user requests to service layer for business logic
 */

import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { userService } from './user.service';
import { sendResponse } from '../../utils/sendResponse';
import httpStatus from 'http-status-codes';

/**
 * Create a new user
 * HTTP Method: POST
 * Route: /api/v1/users
 *
 * Process:
 * 1. Wrapped with catchAsync for automatic error handling
 * 2. Receive user data from request body (validated by middleware)
 * 3. Call userService to perform business logic (validation, db save, etc.)
 * 4. Send success response with created user data
 * 5. Any errors are automatically caught and passed to error handler
 *
 * @param {Request} req - Express request containing user data in req.body
 * @param {Response} res - Express response object
 *
 * Response:
 * Status: 201 Created
 * Body: { statusCode: 201, success: true, message: 'User created successfully', data: user }
 */
const createUser = catchAsync(async (req: Request, res: Response) => {
  // Call service layer to create user (handles validation, db operations, etc.)
  const result = await userService.createUser(req.body);

  // Send success response to client with created user data
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'User created successfully',
    data: result,
  });
});

/**
 * Retrieve all users
 * HTTP Method: GET
 * Route: /api/v1/users
 *
 * Process:
 * 1. Wrapped with catchAsync for automatic error handling
 * 2. Call userService to fetch all users from database
 * 3. Send success response with users array
 * 4. Any errors are automatically caught and passed to error handler
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 *
 * Response:
 * Status: 200 OK
 * Body: { statusCode: 200, success: true, message: 'Users retrieved successfully', data: users[] }
 */
const getAllUser = catchAsync(async (req: Request, res: Response) => {
  // Call service layer to fetch all users from database
  const result = await userService.getAllUser();

  // Send success response with users data
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Users retrieved successfully',
    data: result,
  });
});

/**
 * Retrieve a specific user by ID
 * HTTP Method: GET
 * Route: /api/v1/users/:id
 *
 * Note: Implementation pending
 * TODO: Add implementation to fetch user by ID
 */
const getUserById = catchAsync(async (req: Request, res: Response) => {
  // TODO: Implement get user by ID logic
});

/**
 * Update an existing user
 * HTTP Method: PATCH or PUT
 * Route: /api/v1/users/:id
 *
 * Note: Implementation pending
 * TODO: Add implementation to update user data
 */
const updateUser = catchAsync(async (req: Request, res: Response) => {
  // TODO: Implement update user logic
});

/**
 * Delete a user
 * HTTP Method: DELETE
 * Route: /api/v1/users/:id
 *
 * Note: Implementation pending
 * TODO: Add implementation to delete user
 */
const deleteUser = catchAsync(async (req: Request, res: Response) => {
  // TODO: Implement delete user logic
});

/**
 * User controller object
 * Exports all user-related controller functions
 * These are used in user routes to handle HTTP requests
 */
export const userController = {
  createUser,
  getAllUser,
  getUserById,
  updateUser,
  deleteUser,
};
