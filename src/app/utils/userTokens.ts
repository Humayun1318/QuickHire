import { JwtPayload } from 'jsonwebtoken';
import { envVars } from '../config/env';
import { IsActive, IUser } from '../modules/user/user.interface';
import { generateToken, verifyToken } from './jwt';
import { User } from '../modules/user/user.models';
import AppError from '../errorHelpers/AppError';
import httpStatus from 'http-status-codes';
import { validateUserStatus } from './validateUserStatus';

export const createUserTokens = (
  user: Pick<IUser, '_id' | 'email' | 'role'>,
) => {
  const jwtPayload = {
    userId: user._id,
    email: user.email,
    role: user.role,
  };
  const accessToken = generateToken(
    jwtPayload,
    envVars.JWT_ACCESS_SECRET,
    envVars.JWT_ACCESS_EXPIRES,
  );

  const refreshToken = generateToken(
    jwtPayload,
    envVars.JWT_REFRESH_SECRET,
    envVars.JWT_REFRESH_EXPIRES,
  );

  return {
    accessToken,
    refreshToken,
  };
};

export const createNewAccessTokenByRefreshToken = async (
  refreshToken: string,
) => {
  const verifiedRefreshToken = verifyToken(
    refreshToken,
    envVars.JWT_REFRESH_SECRET,
  ) as JwtPayload;

  const isUserExist = await User.findOne({ email: verifiedRefreshToken.email });
  if (!isUserExist) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User does not exist');
  }

  // Check if user is verified, active, or blocked
  validateUserStatus(isUserExist);

  const jwtPayload = {
    userId: isUserExist._id,
    email: isUserExist.email,
    role: isUserExist.role,
  };
  const accessToken = generateToken(
    jwtPayload,
    envVars.JWT_ACCESS_SECRET,
    envVars.JWT_ACCESS_EXPIRES,
  );

  return accessToken;
};
