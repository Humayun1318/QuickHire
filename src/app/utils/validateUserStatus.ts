import httpStatus from 'http-status-codes';
import AppError from '../errorHelpers/AppError';
import { IsActive, IUser } from '../modules/user/user.interface';

/**
 * Validate user status before allowing access or actions
 * @param user IUser object to validate
 * @throws AppError with professional messages if user is invalid
 */
export const validateUserStatus = (user: IUser) => {
  if (!user.isVerified) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Account verification required. Please verify your email to proceed.',
    );
  }

  if (user.isActive === IsActive.BLOCKED) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Account is blocked. Contact support for assistance.',
    );
  }

  if (user.isActive === IsActive.INACTIVE) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Account is inactive. Please activate your account to continue.',
    );
  }

  if (user.isDeleted) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Account has been deleted and cannot be accessed.',
    );
  }

  return true; // User passed all validations
};
