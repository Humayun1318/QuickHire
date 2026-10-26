import { JwtPayload } from 'jsonwebtoken';
import AppError from '../errorHelpers/AppError';
import { AccountStatus, IUser } from '../modules/user/user.interface';
import httpStatus from 'http-status-codes';

/**
 * Rejects users whose account is not ACTIVE (inactive, suspended, banned).
 */
export const validateUserStatus = (user: IUser) => {
  if (user.status !== AccountStatus.ACTIVE) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Account is ${user.status}. Contact support for assistance.`,
    );
  }

  return true;
};

/**
 * Every token carries the user's tokenVersion ("tv") at issue time. Changing
 * the password increments tokenVersion, which invalidates every previously
 * issued access and refresh token (i.e. logs out all other sessions).
 */
export const validateTokenVersion = (user: IUser, token: JwtPayload) => {
  const tokenVersion = typeof token.tv === 'number' ? token.tv : 0;
  if (tokenVersion !== (user.tokenVersion ?? 0)) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Session is no longer valid. Please log in again.',
    );
  }
};
