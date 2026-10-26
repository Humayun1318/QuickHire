import { envVars } from '../config/env';
import { IUser } from '../modules/user/user.interface';
import { generateToken, verifyToken } from './jwt';
import { User } from '../modules/user/user.models';
import AppError from '../errorHelpers/AppError';
import httpStatus from 'http-status-codes';
import { validateTokenVersion, validateUserStatus } from './validateUserStatus';

type TokenUser = Pick<IUser, '_id' | 'email' | 'role'> & {
  tokenVersion?: number;
};

const buildJwtPayload = (user: TokenUser) => ({
  userId: String(user._id),
  email: user.email,
  role: user.role,
  tv: user.tokenVersion ?? 0,
});

export const createUserTokens = (user: TokenUser) => {
  const jwtPayload = buildJwtPayload(user);

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

/**
 * Issues a new access token from a valid refresh token. The user is reloaded
 * so that the new token reflects the current role/status, and refresh tokens
 * issued before a password change are rejected.
 */
export const createNewAccessTokenByRefreshToken = async (
  refreshToken: string,
) => {
  const verifiedRefreshToken = verifyToken(
    refreshToken,
    envVars.JWT_REFRESH_SECRET,
  );

  const user = await User.findById(verifiedRefreshToken.userId);
  if (!user) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User no longer exists');
  }

  validateUserStatus(user);
  validateTokenVersion(user, verifiedRefreshToken);

  return generateToken(
    buildJwtPayload(user),
    envVars.JWT_ACCESS_SECRET,
    envVars.JWT_ACCESS_EXPIRES,
  );
};
