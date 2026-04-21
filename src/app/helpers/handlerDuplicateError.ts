/**
 * @file handlerDuplicateError.ts
 * @description MongoDB duplicate key error handler
 * Processes MongoDB error code 11000 (unique constraint violation) into readable error messages
 */

import { TGenericErrorResponse } from '../interfaces/error.types';

/**
 * Handles MongoDB duplicate key errors
 *
 * When a document violates a unique index constraint, MongoDB throws error code 11000
 * with a message like: E11000 duplicate key error collection: quickhire.users index: email_1 dup key: { email: "test@example.com" }
 *
 * This function:
 * 1. Extracts the duplicate field name from the error message using regex
 * 2. Formats a user-friendly error message
 * 3. Returns standardized error response
 *
 * @param {any} err - MongoDB error object with code 11000
 * @returns {TGenericErrorResponse} Standardized error response with status code and message
 *
 * Example:
 * Input: MongoDB E11000 error for duplicate email
 * Output: { statusCode: 400, message: "email already exists!!" }
 */
export const handlerDuplicateError = (err: any): TGenericErrorResponse => {
  /**
   * Extract the field name from MongoDB error message
   * Regex pattern: /"([^"]*)"/  matches the first quoted string in the error message
   * This extracts the duplicate field name (e.g., "email")
   *
   * Example error message:
   * E11000 duplicate key error collection: quickhire.users index: email_1 dup key: { email: "test@example.com" }
   * This regex extracts: "email"
   */
  const matchedArray = err.message.match(/"([^"]*)"/);

  // Return standardized error response with 400 status and descriptive message
  return {
    statusCode: 400,
    message: `${matchedArray[1]} already exists!!`,
  };
};
