/**
 * @file validateUserStatus.ts
 * @description User account status validation utility
 * Checks if user account is in valid state before granting access
 */

import httpStatus from 'http-status-codes';
import AppError from '../errorHelpers/AppError';
import { IsActive, IUser } from '../modules/user/user.interface';

/**
 * Validate user account status before allowing access
 *
 * Purpose: Prevent access to application if user account is in an invalid state
 * This is typically called in authentication middleware after token verification
 *
 * Validation checks performed:
 * 1. BLOCKED status: Account has been suspended/locked by admin
 * 2. INACTIVE status: Account was created but not activated by user
 * 3. DELETED status: Account has been soft-deleted and marked for deletion
 *
 * Note: Email verification check is currently disabled but available for future use
 *
 * @param {IUser} user - User document from database
 * @returns {boolean} true if all validations pass
 * @throws {AppError} If user account is in invalid state (BLOCKED, INACTIVE, or DELETED)
 *
 * Typical usage in authentication middleware:
 * const user = await User.findOne({ email: verifiedToken.email });
 * validateUserStatus(user);  // Throws if status is invalid
 *
 * Example error responses:
 * - BLOCKED: { statusCode: 403, message: 'Account is blocked. Contact support for assistance.' }
 * - INACTIVE: { statusCode: 400, message: 'Account is inactive. Please activate your account to continue.' }
 * - DELETED: { statusCode: 400, message: 'Account has been deleted and cannot be accessed.' }
 */
export const validateUserStatus = (user: IUser) => {
  /**
   * Check 1: Email Verification
   * Currently disabled but can be enabled for email verification requirement
   * Uncomment to require email verification before account access
   *
   * if (!user.isVerified) {
   *   throw new AppError(
   *     httpStatus.BAD_REQUEST,
   *     'Account verification required. Please verify your email to proceed.',
   *   );
   * }
   */

  /**
   * Check 2: Account Blocked Status
   * Admins can block accounts due to violations, suspicious activity, etc.
   * BLOCKED users should not have any access to the system
   */
  if (user.isActive === IsActive.BLOCKED) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Account is blocked. Contact support for assistance.',
    );
  }

  /**
   * Check 3: Account Inactive Status
   * Users who haven't completed account activation
   * This could be used to require email verification or account setup completion
   */
  if (user.isActive === IsActive.INACTIVE) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Account is inactive. Please activate your account to continue.',
    );
  }

  /**
   * Check 4: Soft Deleted Account
   * Accounts marked as deleted (soft delete, not permanently removed from database)
   * Deleted accounts should not be accessible
   */
  if (user.isDeleted) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Account has been deleted and cannot be accessed.',
    );
  }

  // All validations passed - return true to indicate valid user status
  return true;
};
