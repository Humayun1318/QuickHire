import AppError from '../../errorHelpers/AppError';
import { AuthProvider, IUser } from './user.interface';
import { User } from './user.models';
import httpStatus from 'http-status-codes';



// Get all users (for admin)
const getAllUser = async () => {
  const users = await User.find().lean();
  return users;
};


const getUserById = async (id: string) => {
  const user = await User.findById(id).lean();
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  return user;
};
const updateUser = async () => {};
const deleteUser = async () => {};

export const userService = {
  getAllUser,
  getUserById,
  updateUser,
  deleteUser,
};
