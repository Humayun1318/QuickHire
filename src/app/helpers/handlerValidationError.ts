/**
 * @file handlerValidationError.ts
 * @description Mongoose schema validation error handler
 * Converts MongoDB/Mongoose validation errors into standardized error responses
 */

import mongoose from 'mongoose';
import {
  TErrorSources,
  TGenericErrorResponse,
} from '../interfaces/error.types';

/**
 * Handles Mongoose schema validation errors
 *
 * Mongoose schema validation errors occur when:
 * - Required fields are missing from the document
 * - Field values don't match the schema type (e.g., string instead of number)
 * - Field values violate custom validation rules
 * - Field values violate enum constraints
 *
 * Examples:
 * - Required field 'email' is missing
 * - Age must be a number, received string
 * - Email must be a valid email format
 * - Role must be one of ['admin', 'user', 'moderator']
 *
 * This function extracts individual field errors and creates a standardized response
 *
 * @param {mongoose.Error.ValidationError} err - Mongoose ValidationError object
 * @returns {TGenericErrorResponse} Standardized error response with field-level errors
 *
 * Error Structure:
 * - statusCode: 400 (Bad Request)
 * - message: 'Validation Error'
 * - errorSources: Array of validation errors per field
 *
 * Example Mongoose ValidationError:
 * {
 *   errors: {
 *     email: { path: 'email', message: 'Email is required' },
 *     age: { path: 'age', message: 'Age must be a number' }
 *   }
 * }
 *
 * Returns:
 * {
 *   statusCode: 400,
 *   message: 'Validation Error',
 *   errorSources: [
 *     { path: 'email', message: 'Email is required' },
 *     { path: 'age', message: 'Age must be a number' }
 *   ]
 * }
 */
export const handlerValidationError = (
  err: mongoose.Error.ValidationError,
): TGenericErrorResponse => {
  // Array to store processed validation errors
  const errorSources: TErrorSources[] = [];

  /**
   * Extract all validation errors from the error object
   * err.errors is an object where keys are field names and values are error details
   */
  const errors = Object.values(err.errors);

  /**
   * Iterate through each validation error
   * Extract the field path and error message
   */
  errors.forEach((errorObject: any) =>
    errorSources.push({
      // Path of the field that failed validation (e.g., 'email', 'age', 'user.profile.phone')
      path: errorObject.path,
      // The validation error message explaining why the field failed
      message: errorObject.message,
    }),
  );

  // Return standardized error response with all validation errors
  return {
    statusCode: 400, // Bad Request - validation failed on client data
    message: 'Validation Error',
    errorSources, // Array of field-specific validation errors
  };
};
