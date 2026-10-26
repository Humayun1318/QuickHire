import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';

/**
 * Validates req.body against a Zod schema and replaces it with the parsed
 * result. Unknown keys are stripped by z.object(), which prevents mass
 * assignment of fields such as role, status or ownerId.
 *
 * Express 5 leaves req.body undefined when no body was sent, so it is
 * validated as an empty object in that case.
 */
export const validateRequestBody =
  (zodSchema: ZodType) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = await zodSchema.parseAsync(req.body ?? {});
      next();
    } catch (error) {
      next(error);
    }
  };

/**
 * Validates req.query against a Zod schema. In Express 5 req.query is a
 * read-only getter, so the parsed value is not written back; handlers keep
 * reading the (now validated) raw query strings.
 */
export const validateRequestQuery =
  (zodSchema: ZodType) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await zodSchema.parseAsync(req.query);
      next();
    } catch (error) {
      next(error);
    }
  };
