import AppError from '../../errorHelpers/AppError';
import {
  createNewAccessTokenByRefreshToken,
  createUserTokens,
} from '../../utils/userTokens';
import { validateUserStatus } from '../../utils/validateUserStatus';
import { IUser } from '../user/user.interface';
import { User } from '../user/user.models';
import httpStatus from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';

const createAuth = async (payload: Partial<IUser>) => {
  const { email, password } = payload;
  if (!email || !password) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Email and password are required',
    );
  }

  const existingUser = await User.findUserByEmail(email!);
  if (!existingUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'No user found with this email');
  }

  // Validate user status (verified, active, blocked, deleted)
  validateUserStatus(existingUser);

  const isPasswordValid = await existingUser.comparePassword(password!);
  if (!isPasswordValid) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid credentials');
  }

  // Generate JWT token
  const userTokens = createUserTokens(existingUser);

  return {
    accessToken: userTokens.accessToken,
    refreshToken: userTokens.refreshToken,
    user: existingUser,
  };
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
  const user = await User.findUserByEmail(userEmail);
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
  createAuth,
  getNewAccessTokenUsingRefreshToken,
  changePassword,
  getAllAuth,
  getAuthById,
  updateAuth,
  deleteAuth,
};
