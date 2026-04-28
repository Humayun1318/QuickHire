/**
 * @file validateRequest.ts
 * @description Request body validation middleware using Zod schemas
 * This middleware validates incoming request bodies against predefined Zod schemas
 * Ensures data integrity and type safety before reaching route handlers
 */

import { NextFunction, Request, Response } from 'express';
import { ZodObject } from 'zod';

/**
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
      // Validate request body against the provided Zod schema
      req.body = await zodSchema.parseAsync(req.body);

      // Validation passed - proceed to next middleware/route handler
      next();
    } catch (error) {
      next(error);
    }
  };
