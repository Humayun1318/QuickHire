
import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { envVars } from '../config/env';
import AppError from '../errorHelpers/AppError';
import { verifyToken } from '../utils/jwt';
import { User } from '../modules/user/user.models';
import { validateUserStatus } from '../utils/validateUserStatus';


export const checkAuth =
  (...authRoles: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      /**
       * Step 1: Extract JWT token from Authorization header
       * Expected format: "Bearer <token>"
       * The token should be the JWT access token generated during login
       */
      const accessToken = req.headers.authorization;

      // Validate token presence
      if (!accessToken) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'No Token Recieved');
      }

      /**
       * Step 2: Verify and decode JWT token
       * - Checks token signature validity
       * - Checks token expiration
       * - Extracts payload containing user information (email, role, etc.)
       */
      const verifiedToken = verifyToken(
        accessToken,
        envVars.JWT_ACCESS_SECRET,
      ) as JwtPayload;

      /**
       * Step 3: Verify user exists in database
       * Ensures the user account still exists (wasn't deleted)
       * Fetches user document for status validation
       */
      const isUserExist = await User.findOne({ email: verifiedToken.email });
      if (!isUserExist) {
        throw new AppError(httpStatus.BAD_REQUEST, 'User does not exist');
      }

      /**
       * Step 4: Validate user account status
       * Checks if user is:
       * - Verified (email verified)
       * - Active (not suspended)
       * - Not blocked (account not locked)
       * Throws error if user status is invalid
       */
      validateUserStatus(isUserExist);

      /**
       * Step 5: Check user role authorization
       * Verifies that the user's role is in the list of allowed roles
       * Example: If endpoint requires 'admin' role but user is 'user', deny access
       */
      if (!authRoles.includes(verifiedToken.role)) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'You are not permitted to view this route!!!',
        );
      }

      /**
       * Step 6: Attach verified token to request object
       * Makes user information accessible to route handlers
       * Available as req.user throughout the request lifecycle
       */
      req.user = verifiedToken;
      next();
    } catch (error) {
      console.log('jwt error', error);
      next(error);
    }
  };
