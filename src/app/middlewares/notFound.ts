/**
 * @file notFound.ts
 * @description 404 Not Found middleware
 * Handles requests to routes that don't exist
 * Must be registered as the last middleware in the Express app
 */

import { Request, Response } from 'express';
import httpStatus from 'http-status-codes';

/**
 * 404 Not Found Handler Middleware
 *
 * This middleware catches all requests that don't match any defined routes
 * and returns a standardized 404 error response
 *
 * Usage: Must be registered AFTER all other routes and middlewares
 * app.use(globalErrorHandler);
 * app.use(notFound);  // Always last
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 *
 * Response:
 * Status: 404 Not Found
 * Body: { success: false, message: "Route Not Found" }
 */
const notFound = (req: Request, res: Response) => {
  // Return standardized 404 response with appropriate HTTP status
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: 'Route Not Found',
  });
};

export default notFound;
