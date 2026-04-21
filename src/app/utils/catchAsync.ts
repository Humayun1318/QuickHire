/**
 * @file catchAsync.ts
 * @description Async error handling wrapper for Express route handlers
 * This utility wraps async route handlers to automatically catch promise rejections
 */

import { NextFunction, Request, Response } from 'express';

/**
 * Type definition for an async route handler function
 * Represents the shape of async controller methods that handle requests
 */
type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

/**
 * Higher-order function (HOF) to wrap async route handlers
 *
 * Purpose: Automatically catch errors in async functions without try-catch blocks
 *
 * How it works:
 * 1. Accepts an async handler function as parameter
 * 2. Returns a new function with Express middleware signature
 * 3. When called, executes the handler function
 * 4. If the handler throws or returns a rejected promise,
 *    automatically passes the error to Express error handler via next(error)
 *
 * Benefits:
 * - Eliminates repetitive try-catch blocks in every route handler
 * - Ensures all async errors are caught and handled consistently
 * - Automatically passes caught errors to global error handler
 * - Makes controller code cleaner and more readable
 *
 * @param {AsyncHandler} fn - The async route handler function to wrap
 * @returns {Function} Wrapped function with automatic error catching
 *
 * Example Usage:
 * const createUser = catchAsync(async (req: Request, res: Response) => {
 *   const user = await userService.createUser(req.body);
 *   sendResponse(res, { statusCode: 201, data: user });
 * });
 *
 * Without catchAsync, would need:
 * const createUser = async (req: Request, res: Response, next: NextFunction) => {
 *   try {
 *     const user = await userService.createUser(req.body);
 *     sendResponse(res, { statusCode: 201, data: user });
 *   } catch (error) {
 *     next(error);
 *   }
 * };
 */
const catchAsync =
  (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
    /**
     * Execute the async handler and catch any promise rejections
     * Promise.resolve() ensures the return value is treated as a promise
     * .catch() intercepts any errors and passes them to the error handler
     */
    Promise.resolve(fn(req, res, next)).catch((err: any) => {
      // Pass caught error to Express global error handler
      next(err);
    });
  };

export default catchAsync;
