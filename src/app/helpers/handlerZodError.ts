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
 * - message: 'Validation Error'
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
 *   message: 'Validation Error',
 *   errorSources: [
 *     { path: 'email', message: 'Invalid email' },
 *     { path: 'password', message: 'Must be at least 8 characters' }
 *   ]
 * }
 */
export const handlerZodError = (err: {
  issues: { path: PropertyKey[]; message: string }[];
}): TGenericErrorResponse => {
  /**
   * Each issue is reported with its full dotted path so nested fields stay
   * unambiguous: ['address', 'city'] -> 'address.city'
   */
  const errorSources: TErrorSources[] = err.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));

  return {
    statusCode: 400, // Bad Request - client provided invalid data
    message: 'Validation Error',
    errorSources, // Array of field-specific errors
  };
};
