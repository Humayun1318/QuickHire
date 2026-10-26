/**
 * @file globalErrorHandler.ts
 * @description Express error handling middleware for centralized error management
 * Normalizes the different error types (MongoDB, Zod, JWT, body parser,
 * AppError, ...) into one consistent response shape:
 *   { success: false, message, errorSources, err?, stack? }
 * `err` and `stack` are only included in development.
 */

import { NextFunction, Request, Response } from 'express';
import { envVars } from '../config/env';
import { TErrorSources } from '../interfaces/error.types';
import { handlerDuplicateError } from '../helpers/handlerDuplicateError';
import { handleCastError } from '../helpers/handleCastError';
import { handlerZodError } from '../helpers/handlerZodError';
import { handlerValidationError } from '../helpers/handlerValidationError';
import AppError from '../errorHelpers/AppError';
import { HTTP_STATUS_CODE } from '../utils/HTTP_STATUS_CODE';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyError = any;

export const globalErrorHandler = (
  err: AnyError,
  req: Request,
  res: Response,
  // Express identifies error handlers by their 4-argument signature.
  _next: NextFunction,
) => {
  let errorSources: TErrorSources[] = [];
  let statusCode: number = HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR;
  let message = 'Something went wrong';

  if (err?.code === 11000) {
    // MongoDB unique index violation
    const simplifiedError = handlerDuplicateError(err);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
  } else if (err?.name === 'CastError') {
    // Malformed ObjectId or value of the wrong type
    const simplifiedError = handleCastError(err);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
  } else if (err?.name === 'ZodError') {
    const simplifiedError = handlerZodError(err);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errorSources = simplifiedError.errorSources as TErrorSources[];
  } else if (err?.name === 'ValidationError') {
    // Mongoose schema validation
    const simplifiedError = handlerValidationError(err);
    statusCode = simplifiedError.statusCode;
    errorSources = simplifiedError.errorSources as TErrorSources[];
    message = simplifiedError.message;
  } else if (err?.name === 'TokenExpiredError') {
    statusCode = HTTP_STATUS_CODE.UNAUTHORIZED;
    message = 'Token has expired. Please log in again.';
  } else if (
    err?.name === 'JsonWebTokenError' ||
    err?.name === 'NotBeforeError'
  ) {
    statusCode = HTTP_STATUS_CODE.UNAUTHORIZED;
    message = 'Invalid token. Please log in again.';
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (
    typeof err?.status === 'number' &&
    err.status >= 400 &&
    err.status < 500
  ) {
    // Errors raised by Express / body-parser (malformed JSON, body too large, ...)
    statusCode = err.status;
    message =
      err.type === 'entity.parse.failed'
        ? 'Malformed JSON in request body'
        : err.type === 'entity.too.large'
          ? 'Request body is too large'
          : err.message;
  }

  // Unexpected errors: log server-side, never leak internals to clients in
  // production.
  if (statusCode >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    if (envVars.NODE_ENV === 'development' && err instanceof Error) {
      message = err.message;
    }
  }

  const isDev = envVars.NODE_ENV === 'development';

  res.status(statusCode).json({
    success: false,
    message,
    errorSources,
    ...(isDev ? { err, stack: err?.stack } : {}),
  });
};
