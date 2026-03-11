import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { envVars } from '../config/env';
import AppError from '../errorHelpers/AppError';
import { IsActive } from '../modules/user/user.interface';
import { verifyToken } from '../utils/jwt';
import { User } from '../modules/user/user.models';
import { validateUserStatus } from '../utils/validateUserStatus';

export const checkAuth =
  (...authRoles: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accessToken = req.headers.authorization;

      if (!accessToken) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'No Token Recieved');
      }

      const verifiedToken = verifyToken(
        accessToken,
        envVars.JWT_ACCESS_SECRET,
      ) as JwtPayload;

      const isUserExist = await User.findOne({ email: verifiedToken.email });
      if (!isUserExist) {
        throw new AppError(httpStatus.BAD_REQUEST, 'User does not exist');
      }

      // Check if user is verified, active, or blocked
      validateUserStatus(isUserExist);

      // console.log('verifiedToken', verifiedToken, 'authRoles', authRoles);

      if (!authRoles.includes(verifiedToken.role)) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'You are not permitted to view this route!!!',
        );
      }
      req.user = verifiedToken;
      next();
    } catch (error) {
      console.log('jwt error', error);
      next(error);
    }
  };
