import AppError from '../../errorHelpers/AppError';
import { AuthProvider, IUser } from './user.interface';
import { User } from './user.models';
import httpStatus from 'http-status-codes';

const createUser = async (payload: IUser) => {
  const { email } = payload;

  // // check if user already exists giving me with password field
  const existingUser = await User.findUserByEmail(email);

  if (existingUser) {
    throw new AppError(
      httpStatus.CONFLICT,
      'User already exists with this email',
    );
  }

  // // ensure auth provider exists
  // if (!payload.auths || payload.auths.length === 0) {
  //   throw new AppError(
  //     httpStatus.BAD_REQUEST,
  //     'At least one authentication provider is required',
  //   );
  // }

  // //check if CREDENTIALS provider exists
  // const hasCredentialsProvider = payload.auths.some(
  //   (auth) => auth.provider === AuthProvider.CREDENTIALS,
  // );

  // // local provider must have password
  // if (hasCredentialsProvider && !payload.password) {
  //   throw new AppError(
  //     httpStatus.BAD_REQUEST,
  //     'Password is required for credentials authentication',
  //   );
  // }

  // // if oauth provider, password should not be required
  // if (!hasCredentialsProvider && payload.password) {
  //   delete payload.password;
  // }

  // Normalize auths: set providerId to email
  payload.auths = payload?.auths?.map(() => ({
    provider: AuthProvider.CREDENTIALS,
    providerId: email,
  })) || [
    {
      provider: AuthProvider.CREDENTIALS,
      providerId: email,
    },
  ];

  // // create user
  const user = await User.create(payload);
  return user;
};

// Get all users (for admin)
const getAllUser = async () => {
  const users = await User.find().lean();
  return users;
};


const getUserById = async () => {};
const updateUser = async () => {};
const deleteUser = async () => {};

export const userService = {
  createUser,
  getAllUser,
  getUserById,
  updateUser,
  deleteUser,
};
