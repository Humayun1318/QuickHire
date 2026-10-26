/**
 * @file handlerDuplicateError.ts
 * @description MongoDB duplicate key error handler
 * Processes MongoDB error code 11000 (unique constraint violation) into a
 * readable 409 Conflict response.
 */

import { TGenericErrorResponse } from '../interfaces/error.types';
import { HTTP_STATUS_CODE } from '../utils/HTTP_STATUS_CODE';

/**
 * The MongoDB driver exposes the offending field(s) on `err.keyValue`, e.g.
 * `{ email: "test@example.com" }`. Only the field name is reported — the
 * value is not echoed back to the client.
 */
export const handlerDuplicateError = (err: {
  keyValue?: Record<string, unknown>;
}): TGenericErrorResponse => {
  const fields = Object.keys(err.keyValue ?? {});
  const fieldLabel = fields.length ? fields.join(', ') : 'Resource';

  return {
    statusCode: HTTP_STATUS_CODE.CONFLICT,
    message: `${fieldLabel} already exists`,
  };
};
