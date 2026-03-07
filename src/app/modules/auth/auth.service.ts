import { envVars } from '../../config/env';
import AppError from '../../errorHelpers/AppError';
import { generateToken } from '../../utils/jwt';
import { validateUserStatus } from '../../utils/validateUserStatus';
import { IUser } from '../user/user.interface';
import { User } from '../user/user.models';
import httpStatus from 'http-status-codes';

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
  const jwtPayload = {
    userId: existingUser._id,
    email: existingUser.email,
    role: existingUser.role,
  };

  const accessToken = generateToken(
    jwtPayload,
    envVars.JWT_ACCESS_SECRET,
    envVars.JWT_ACCESS_EXPIRES,
  );

  return {
    accessToken,
  };
};
const getAllAuth = async () => {};
const getAuthById = async () => {};
const updateAuth = async () => {};
const deleteAuth = async () => {};

export const authService = {
  createAuth,
  getAllAuth,
  getAuthById,
  updateAuth,
  deleteAuth,
};
