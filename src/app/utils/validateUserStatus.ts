import AppError from "../errorHelpers/AppError";
import { AccountStatus, IUser } from "../modules/user/user.interface";
import httpStatus from 'http-status-codes';

export const validateUserStatus = (user: IUser) => {
  /**
   * EMAIL VERIFICATION CHECK
   * (optional feature - uncomment if required)
   */
  // if (!user.isVerified) {
  //   throw new AppError(
  //     httpStatus.BAD_REQUEST,
  //     'Account verification required. Please verify your email to proceed.',
  //   );
  // }

  /**
   * ACCOUNT ACTIVE STATUS CHECK (MODEL-LEVEL METHOD)
   * Instead of raw enum checks, we use domain method
   */
  if (user.status !== AccountStatus.ACTIVE) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Account is ${user.status}. Contact support for assistance.`,
    );
  }

  /**
   * SOFT DELETE CHECK (SAFE fallback)
   * If your model has isDeleted field
   */
  // if ((user as any).isDeleted) {
  //   throw new AppError(
  //     httpStatus.BAD_REQUEST,
  //     'Account has been deleted and cannot be accessed.',
  //   );
  // }

  return true;
};