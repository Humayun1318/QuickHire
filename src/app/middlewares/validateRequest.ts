/**
 * @file validateRequest.ts
 * @description Request body validation middleware using Zod schemas
 * This middleware validates incoming request bodies against predefined Zod schemas
 * Ensures data integrity and type safety before reaching route handlers
 */

import { NextFunction, Request, Response } from 'express';
import { ZodObject } from 'zod';

/**
 * Middleware factory for request validation
 *
 * Pattern: Higher-order function that accepts a Zod schema and returns middleware
 *
 * Validation Process:
 * 1. Parse request body data if it's JSON stringified (multipart form handling)
 * 2. Validate parsed body against the provided Zod schema
 * 3. Replace req.body with validated and sanitized data
 * 4. Pass to next middleware if validation succeeds
 * 5. Pass error to error handler if validation fails
 *
 * @param {ZodObject} zodSchema - Zod schema object that defines the validation rules
 * @returns {Function} Express middleware function
 *
 * Example Usage:
 * app.post('/users', validateRequest(userCreateSchema), userController.createUser)
 */
export const validateRequest =
  (zodSchema: ZodObject<any>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      /**
       * Handle multipart/form-data bodies
       * Some form submissions stringify JSON data in req.body.data
       * This section detects and parses that data back into an object
       *
       * Fallback: If no .data field exists, use req.body as-is
       */
      if (req.body.data) {
        // Parse stringified JSON from multipart form submission
        req.body = JSON.parse(req.body.data);
      }

      /**
       * Validate request body against the provided Zod schema
       * - Ensures all required fields are present
       * - Validates field types and formats
       * - Sanitizes and transforms the data according to schema rules
       * - Throws error if any validation fails
       */
      req.body = await zodSchema.parseAsync(req.body);

      // Validation passed - proceed to next middleware/route handler
      next();
    } catch (error) {
      /**
       * Validation failed - pass error to global error handler
       * The globalErrorHandler will catch ZodError and format it appropriately
       */
      next(error);
    }
  };
