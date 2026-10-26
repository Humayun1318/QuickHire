import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status-codes';
import { envVars } from '../config/env';
import AppError from '../errorHelpers/AppError';
import { verifyToken } from '../utils/jwt';
import { User } from '../modules/user/user.models';
import {
  validateTokenVersion,
  validateUserStatus,
} from '../utils/validateUserStatus';

/**
 * Reads the access token from the Authorization header ("Bearer <token>" or
 * the bare token, kept for backwards compatibility) or from the httpOnly
 * accessToken cookie.
 */
const extractAccessToken = (req: Request): string | undefined => {
  const header = req.headers.authorization;
  if (header) {
    const [scheme, value] = header.split(' ');
    if (value && scheme.toLowerCase() === 'bearer') return value.trim();
    if (!value) return scheme.trim();
  }
  const cookieToken = req.cookies?.accessToken;
  return typeof cookieToken === 'string' ? cookieToken : undefined;
};

/**
 * Authentication + role-based authorization guard.
 *
 * The user is re-loaded from the database on every request, and the role
 * check uses the CURRENT database role — not the role embedded in the token —
 * so role changes, suspensions and deletions take effect immediately.
 */
export const checkAuth =
  (...authRoles: string[]) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const accessToken = extractAccessToken(req);
      if (!accessToken) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          'Authentication required. No access token provided.',
        );
      }

      const verifiedToken = verifyToken(accessToken, envVars.JWT_ACCESS_SECRET);

      const user = await User.findById(verifiedToken.userId);
      if (!user) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'User no longer exists');
      }

      validateUserStatus(user);
      validateTokenVersion(user, verifiedToken);

      if (authRoles.length && !authRoles.includes(user.role)) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'You are not permitted to access this route',
        );
      }

      req.user = {
        ...verifiedToken,
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
