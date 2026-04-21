/**
 * @file handleCastError.ts
 * @description MongoDB Cast Error handler
 * Processes invalid MongoDB ObjectID format errors into readable error messages
 */

import mongoose from 'mongoose';
import { TGenericErrorResponse } from '../interfaces/error.types';

/**
 * Handles MongoDB Cast Errors
 *
 * Cast errors occur when:
 * - An invalid ObjectID format is provided in a query (not a valid 24-character hex string)
 * - Attempting to find/update/delete a document with malformed ID
 * - Example: /api/v1/users/invalidid instead of /api/v1/users/507f1f77bcf86cd799439011
 *
 * This function converts MongoDB's technical error into a user-friendly message
 *
 * @param {mongoose.Error.CastError} err - MongoDB CastError object
 * @returns {TGenericErrorResponse} Standardized error response with status code and message
 *
 * Example:
 * Input: CastError from MongoDB for invalid ObjectID
 * Output: { statusCode: 400, message: "Invalid MongoDB ObjectID. Please provide a valid id" }
 */
export const handleCastError = (
  err: mongoose.Error.CastError,
): TGenericErrorResponse => {
  // Return standardized error response explaining the issue and how to fix it
  return {
    statusCode: 400,
    message: 'Invalid MongoDB ObjectID. Please provide a valid id',
  };
};
