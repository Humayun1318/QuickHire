import AppError from '../../errorHelpers/AppError';
import { User } from './user.models';
import httpStatus from 'http-status-codes';
import { QueryBuilder } from '../../builder/QueryBuilder';
import { userBuilderConfig } from './user.constants';

// Paginated, filterable user list (admin only)
const getAllUser = async (query: Record<string, unknown>) => {
  const { data, meta } = await new QueryBuilder(
    User,
    User.find(),
    query,
    userBuilderConfig,
  )
    .search()
    .filter()
    .sort()
    .paginate()
    .lean()
    .execute();

  return { data, meta };
};

const getUserById = async (id: string) => {
  const user = await User.findById(id).lean();
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  return user;
};

export const userService = {
  getAllUser,
  getUserById,
};
