/**
 * @file handlerZodError.ts
 * @description Zod validation error handler
 * Converts Zod validation errors into standardized error responses
 */

import {
  TErrorSources,
  TGenericErrorResponse,
} from '../interfaces/error.types';

/**
 * Handles Zod validation errors from request body validation
 *
 * Zod is a TypeScript-first schema validation library used in validateRequest middleware
 * When request data fails Zod schema validation, this function processes the error
 *
 * Process:
 * 1. Extract validation issues from Zod error object
 * 2. Map each issue to a structured error source (field path and error message)
 * 3. Return standardized error response with all validation errors
 *
 * @param {any} err - Zod error object containing validation issues
 * @returns {TGenericErrorResponse} Standardized error response with field-level errors
 *
 * Error Structure:
 * - statusCode: 400 (Bad Request)
 * - message: 'Zod Error'
 * - errorSources: Array of validation errors per field
 *
 * Example Zod Error:
 * {
 *   name: 'ZodError',
 *   issues: [
 *     { path: ['email'], message: 'Invalid email' },
 *     { path: ['password'], message: 'Must be at least 8 characters' }
 *   ]
 * }
 *
 * Returns:
 * {
 *   statusCode: 400,
 *   message: 'Zod Error',
 *   errorSources: [
 *     { path: 'email', message: 'Invalid email' },
 *     { path: 'password', message: 'Must be at least 8 characters' }
 *   ]
 * }
 */
export const handlerZodError = (err: any): TGenericErrorResponse => {
  // Array to store processed validation errors
  const errorSources: TErrorSources[] = [];

  /**
   * Iterate through each validation issue from Zod
   * Extract the field path and error message
   * The path is an array (e.g., ['user', 'email']), so we get the last element (field name)
   */
  err.issues.forEach((issue: any) => {
    // Extract the field name from the path array (last element)
    // Example: path=['email'] -> get 'email'
    // Example: path=['user', 'profile', 'phone'] -> get 'phone'
    errorSources.push({
      path: issue.path[issue.path.length - 1],
      // The error message explaining why validation failed
      message: issue.message,
    });
  });

  // Return standardized error response with all validation errors
  return {
    statusCode: 400, // Bad Request - client provided invalid data
    message: 'Zod Error',
    errorSources, // Array of field-specific errors
  };
};
