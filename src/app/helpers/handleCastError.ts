/**
 * @file handleCastError.ts
 * @description MongoDB Cast Error handler
 * Processes invalid ObjectId / wrong-type values into a 400 response.
 */

import mongoose from 'mongoose';
import { TGenericErrorResponse } from '../interfaces/error.types';

/**
 * Cast errors occur when a value cannot be converted to the schema type,
 * most commonly a malformed ObjectId such as /users/invalid-id.
 */
export const handleCastError = (
  err: mongoose.Error.CastError,
): TGenericErrorResponse => {
  const message =
    err.kind === 'ObjectId'
      ? `Invalid ID for '${err.path}'. Please provide a valid id`
      : `Invalid value for '${err.path}'`;

  return {
    statusCode: 400,
    message,
  };
};
