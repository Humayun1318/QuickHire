/**
 * @file isValidObjectId.ts
 * @description MongoDB ObjectID validation utility
 * Validates if a given string is a valid MongoDB ObjectID format
 */

import mongoose from 'mongoose';

/**
 * Validate if a string is a valid MongoDB ObjectID
 *
 * MongoDB ObjectIDs are 24-character hexadecimal strings
 * Format: 507f1f77bcf86cd799439011
 *
 * This function checks if the provided ID:
 * - Contains only valid hexadecimal characters (0-9, a-f)
 * - Is exactly 24 characters long
 * - Can be converted to a MongoDB ObjectID
 *
 * @param {string} id - The ID string to validate
 * @returns {boolean} true if valid MongoDB ObjectID format, false otherwise
 *
 * Usage Examples:
 * isValidObjectId('507f1f77bcf86cd799439011');  // Returns: true
 * isValidObjectId('invalid-id');                 // Returns: false
 * isValidObjectId('12345');                      // Returns: false
 *
 * Common usage in routes:
 * if (!isValidObjectId(req.params.id)) {
 *   throw new AppError(400, 'Invalid user ID format');
 * }
 */
export const isValidObjectId = (id: string): boolean => {
  // Use Mongoose's built-in ObjectID validator
  // This checks if the ID is a valid MongoDB ObjectID format
  return mongoose.Types.ObjectId.isValid(id);
};
