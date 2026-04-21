/**
 * @file globalErrorHandler.ts
 * @description Express error handling middleware for centralized error management
 * This middleware catches all errors thrown in route handlers and error handlers
 * Normalizes various error types (MongoDB, Zod, Validation, etc.) into consistent responses
 */

import { NextFunction, Request, Response } from 'express';
import { envVars } from '../config/env';
import { TErrorSources } from '../interfaces/error.types';
import { handlerDuplicateError } from '../helpers/handlerDuplicateError';
import { handleCastError } from '../helpers/handleCastError';
import { handlerZodError } from '../helpers/handlerZodError';
import { handlerValidationError } from '../helpers/handlerValidationError';
import AppError from '../errorHelpers/AppError';

/**
 * Global Error Handler Middleware
 *
 * Middleware signature: (err, req, res, next) - Express recognizes this as error handler
 * Flow:
 * 1. Receives error from next() call in a route handler
 * 2. Identifies error type and extracts relevant information
 * 3. Normalizes error response structure
 * 4. Sends appropriate HTTP status and error details to client
 *
 * Handled Error Types:
 * - Duplicate errors (MongoDB code 11000)
 * - Cast errors (Invalid MongoDB ObjectID)
 * - Zod validation errors (Input validation)
 * - Mongoose validation errors (Schema validation)
 * - Custom AppError instances
 * - Generic JavaScript errors
 */
export const globalErrorHandler = async (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Initialize error response properties
  let errorSources: TErrorSources[] = []; // Array of field-specific errors
  let statusCode = 500; // Default to server error
  let message = 'Something Went Wrong!!'; // Default error message

  /**
   * Error Type Handling: Duplicate Database Entry
   * MongoDB returns error code 11000 when a unique field has duplicate values
   * Example: Duplicate email, username, or other unique field
   */
  if (err.code === 11000) {
    const simplifiedError = handlerDuplicateError(err);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
  } else if (err.name === 'CastError') {
    /**
     * Error Type Handling: Invalid MongoDB ObjectID (Cast Error)
     * Occurs when an invalid ID format is provided for MongoDB queries
     * Example: /users/invalidid instead of /users/507f1f77bcf86cd799439011
     */
    const simplifiedError = handleCastError(err);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
  } else if (err.name === 'ZodError') {
    /**
     * Error Type Handling: Zod Validation Errors
     * Zod is used for request body validation using schemas
     * Multiple field errors are possible in a single request
     */
    const simplifiedError = handlerZodError(err);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errorSources = simplifiedError.errorSources as TErrorSources[];
  } else if (err.name === 'ValidationError') {
    /**
     * Error Type Handling: Mongoose Schema Validation Errors
     * Occurs when document fails schema validation before saving to database
     * Example: Required fields missing, field values invalid, etc.
     */
    const simplifiedError = handlerValidationError(err);
    statusCode = simplifiedError.statusCode;
    errorSources = simplifiedError.errorSources as TErrorSources[];
    message = simplifiedError.message;
  } else if (err instanceof AppError) {
    /**
     * Error Type Handling: Custom AppError Instances
     * These are application-specific errors thrown with explicit status codes
     * Example: throw new AppError(404, 'User not found')
     */
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof Error) {
    /**
     * Error Type Handling: Generic JavaScript Errors
     * Fallback for unspecified errors (typeof errors, reference errors, etc.)
     */
    statusCode = 500;
    message = err.message;
  }

  /**
   * Send Error Response to Client
   * Response structure:
   * - success: false to indicate failed request
   * - message: User-friendly error description
   * - errorSources: Array of specific field errors (if any)
   * - err: Full error object (only in development environment)
   * - stack: Stack trace (only in development environment)
   */
  res.status(statusCode).json({
    success: false,
    message,
    errorSources,
    // Only expose full error details in development for easier debugging
    err: envVars.NODE_ENV === 'development' ? err : null,
    // Only expose stack trace in development for debugging purposes
    stack: envVars.NODE_ENV === 'development' ? err.stack : null,
  });
};
