/**
 * @file sendResponse.ts
 * @description Standardized API response utility
 * Ensures all API responses follow a consistent format
 */

import { Response } from 'express';

/**
 * Generic response interface for type-safe responses
 * @template T - The type of data being returned
 */
interface TResponse<T> {
  // HTTP status code (200, 201, 400, 401, 404, 500, etc.)
  statusCode: number;

  // Indicates if the request was successful (true) or failed (false)
  success: boolean;

  // Human-readable message describing the response
  message: string;

  // The actual data returned to the client (could be null for errors)
  data: T;
}

/**
 * Sends a standardized JSON response to the client
 *
 * Purpose: Ensures all API responses follow a consistent structure
 * This improves frontend consistency and API predictability
 *
 * Generic Type Parameter:
 * - T: The type of the data property (ensures type safety)
 *
 * @template T - Type of the response data
 * @param {Response} res - Express response object
 * @param {TResponse<T>} data - Response object containing status, message, and data
 *
 * Response Structure:
 * {
 *   statusCode: number,      // HTTP status code
 *   success: boolean,        // true/false
 *   message: string,         // Descriptive message
 *   data: T                  // Actual response data
 * }
 *
 * Usage Examples:
 *
 * Success response:
 * sendResponse(res, {
 *   statusCode: 200,
 *   success: true,
 *   message: 'User fetched successfully',
 *   data: user
 * });
 *
 * Error response:
 * sendResponse(res, {
 *   statusCode: 400,
 *   success: false,
 *   message: 'Invalid input',
 *   data: null
 * });
 */
export const sendResponse = <T>(res: Response, data: TResponse<T>) => {
  // Send JSON response with consistent structure
  res.status(data.statusCode).json({
    statusCode: data.statusCode,
    success: data.success,
    message: data.message,
    data: data.data,
  });
};
