/**
 * @class AppError
 * @description Custom error class for application-specific errors
 * Extends the native JavaScript Error class to include HTTP status codes
 * Used throughout the application to throw consistent, structured errors
 */
class AppError extends Error {
  // HTTP status code associated with this error
  public statusCode: number;

  /**
   * Constructor for creating AppError instances
   * @param {number} statusCode - HTTP status code (200-599) for the error
   * @param {string} message - Human-readable error message to send to the client
   * @param {string} stack - Optional custom stack trace (defaults to auto-captured)
   *
   * Example usage:
   * throw new AppError(404, 'User not found');
   * throw new AppError(400, 'Invalid email format');
   * throw new AppError(401, 'Unauthorized access');
   */
  constructor(statusCode: number, message: string, stack = '') {
    // Initialize Error base class with the error message
    super(message);

    // Store the HTTP status code as a property
    this.statusCode = statusCode;

    // Set or auto-capture the stack trace
    if (stack) {
      // Use provided custom stack trace
      this.stack = stack;
    } else {
      // Automatically capture the stack trace at the point where error was thrown
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default AppError;
