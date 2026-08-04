import AppError from '../../errorHelpers/AppError';
import {
  createNewAccessTokenByRefreshToken,
  createUserTokens,
} from '../../utils/userTokens';
import { validateUserStatus } from '../../utils/validateUserStatus';
import { AuthProvider, IUser } from '../user/user.interface';
import { User } from '../user/user.models';
import httpStatus from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';

const createUser = async (payload: IUser) => {
  const { email } = payload;

  // check if user already exists giving me with password field
  const existingUser = await User.findByEmail(email);

  if (existingUser) {
    throw new AppError(
      httpStatus.CONFLICT,
      'User already exists with this email',
    );
  }

  // Normalize auths: set providerId to email
  payload.auths = payload?.auths?.map(() => ({
    provider: AuthProvider.LOCAL,
    providerId: email,
  })) || [
    {
      provider: AuthProvider.LOCAL,
      providerId: email,
    },
  ];

  // //check if CREDENTIALS provider exists
  const hasCredentialsProvider = payload.auths.some(
    (auth) => auth.provider === AuthProvider.LOCAL,
  );

  // local provider must have password
  if (hasCredentialsProvider && !payload.password) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Password is required for credentials authentication',
    );
  }

  // create user
  const user = await User.create(payload);
  return user;
};

const getNewAccessTokenUsingRefreshToken = async (refreshToken: string) => {
  if (!refreshToken) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'No refresh token recieved from cookies',
    );
  }

  const accessTokenInfo =
    await createNewAccessTokenByRefreshToken(refreshToken);

  return {
    accessToken: accessTokenInfo,
  };
};

const changePassword = async (
  payload: {
    oldPassword: string;
    newPassword: string;
  },
  userEmail: string,
) => {
  const { oldPassword, newPassword } = payload;
  const user = await User.findByEmail(userEmail);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  const isOldPasswordMatch = await user.comparePassword(oldPassword);
  if (!isOldPasswordMatch) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Old Password does not match');
  }

  user.password = newPassword;

  await user.save();
  return;
};

const getAllAuth = async () => {};
const getAuthById = async () => {};
const updateAuth = async () => {};
const deleteAuth = async () => {};

export const authService = {
  createUser,
  // createAuth,
  getNewAccessTokenUsingRefreshToken,
  changePassword,
  getAllAuth,
  getAuthById,
  updateAuth,
  deleteAuth,
};
