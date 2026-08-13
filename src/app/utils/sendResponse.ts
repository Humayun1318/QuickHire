
import { Response } from 'express';

interface TResponse<T> {
  // HTTP status code (200, 201, 400, 401, 404, 500, etc.)
  statusCode: number;

  // Indicates if the request was successful (true) or failed (false)
  success: boolean;
  // Human-readable message describing the response
  message: string;
  // The actual data returned to the client (could be null for errors)
  data: T;
  // Optional pagination meta (page, limit, total, totalPages, ...)
  meta?: Record<string, unknown>;
}


export const sendResponse = <T>(res: Response, data: TResponse<T>) => {
  // Send JSON response with consistent structure
  res.status(data.statusCode).json({
    statusCode: data.statusCode,
    success: data.success,
    message: data.message,
    data: data.data,
    ...(data.meta ? { meta: data.meta } : {}),
  });
};
