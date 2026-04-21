/**
 * @file checkAuth.ts
 * @description Authentication and authorization middleware
 * Verifies JWT tokens and checks user permissions based on roles
 */

import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { envVars } from '../config/env';
import AppError from '../errorHelpers/AppError';
import { IsActive } from '../modules/user/user.interface';
import { verifyToken } from '../utils/jwt';
import { User } from '../modules/user/user.models';
import { validateUserStatus } from '../utils/validateUserStatus';

/**
 * Authentication and Authorization Middleware Factory
 *
 * Purpose: Verify JWT tokens and ensure user has required roles
 *
 * Middleware flow:
 * 1. Extract JWT token from Authorization header
 * 2. Verify token signature and expiration
 * 3. Check if the user exists in the database
 * 4. Validate user status (verified, active, not blocked)
 * 5. Check if user's role matches required roles
 * 6. Attach decoded token to request object
 * 7. Pass to next middleware if all checks pass
 * 8. Throw error if any check fails
 *
 * @param {...string[]} authRoles - Array of allowed user roles (e.g., 'admin', 'user')
 * @returns {Function} Express middleware function
 *
 * Usage Examples:
 * router.get('/admin-panel', checkAuth('admin'), adminController.getPanelData);
 * router.post('/profile', checkAuth('user', 'admin'), userController.updateProfile);
 * router.delete('/jobs/:id', checkAuth('admin'), jobController.deleteJob);
 */
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
      // Log error for debugging purposes
      console.log('jwt error', error);
      // Pass error to global error handler
      next(error);
    }
  };
