import AppError from '../../errorHelpers/AppError';
import { createNewAccessTokenByRefreshToken } from '../../utils/userTokens';
import { AuthProvider, UserRole } from '../user/user.interface';
import { User } from '../user/user.models';
import httpStatus from 'http-status-codes';

interface IRegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
  avatar?: string | null;
  role: UserRole.SEEKER | UserRole.EMPLOYER;
}

/**
 * Registers a local (email + password) account. The payload has already been
 * validated by authValidation.registerSchema, which strips unknown fields and
 * restricts the role to seeker/employer.
 */
const createUser = async (payload: IRegisterPayload) => {
  const { email } = payload;

  const existingUser = await User.exists({ email });
  if (existingUser) {
    throw new AppError(
      httpStatus.CONFLICT,
      'User already exists with this email',
    );
  }

  // The unique email index still guards against a concurrent duplicate
  // registration (mapped to 409 by the global error handler).
  const user = await User.create({
    ...payload,
    auths: [{ provider: AuthProvider.LOCAL, providerId: email }],
  });

  return user;
};

const getNewAccessTokenUsingRefreshToken = async (refreshToken: unknown) => {
  if (!refreshToken || typeof refreshToken !== 'string') {
    throw new AppError(httpStatus.UNAUTHORIZED, 'No refresh token received');
  }

  const accessToken = await createNewAccessTokenByRefreshToken(refreshToken);

  return { accessToken };
};

/**
 * Changes the password of the logged-in user. Incrementing tokenVersion
 * invalidates all previously issued tokens (all sessions are logged out);
 * the controller issues fresh tokens for the current session.
 */
const changePassword = async (
  payload: {
    oldPassword: string;
    newPassword: string;
  },
  userId: string,
) => {
  const { oldPassword, newPassword } = payload;

  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  const isOldPasswordMatch = await user.comparePassword(oldPassword);
  if (!isOldPasswordMatch) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Old password does not match');
  }

  user.password = newPassword; // hashed by the pre-save hook
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;

  await user.save();
  return user;
};

export const authService = {
  createUser,
  getNewAccessTokenUsingRefreshToken,
  changePassword,
};
