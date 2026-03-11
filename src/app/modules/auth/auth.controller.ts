import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { authService } from './auth.service';
import { sendResponse } from '../../utils/sendResponse';
import httpStatus from 'http-status-codes';
import { setAuthCookie } from '../../utils/setAuthCookie';
import { envVars } from '../../config/env';

const credentialsLogin = catchAsync(async (req: Request, res: Response) => {
  const loginInfo = await authService.createAuth(req.body);

  // Set access and refresh tokens in HTTP-only cookies
  setAuthCookie(res, loginInfo);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Login successfully',
    data: loginInfo,
  });
});
const getNewAccessTokenUsingRefreshToken = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    console.log(
      'Received request for new access token with cookies:',
      req.cookies,
    );
    const refreshToken = req?.cookies?.refreshToken;

    const tokenInfo =
      await authService.getNewAccessTokenUsingRefreshToken(refreshToken);

    // Set the new access token in an HTTP-only cookie
    setAuthCookie(res, tokenInfo);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'New Access Token Retrived Successfully',
      data: tokenInfo,
    });
  },
);
const logout = catchAsync(async (req: Request, res: Response) => {
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: envVars.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: envVars.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'User Logged Out Successfully',
    data: null,
  });
});

const changePassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    await authService.changePassword(req.body, req.user.email);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Password Changed Successfully',
      data: null,
    });
  },
);

const getAllAuth = catchAsync(async (req: Request, res: Response) => {});
const getAuthById = catchAsync(async (req: Request, res: Response) => {});
const updateAuth = catchAsync(async (req: Request, res: Response) => {});
const deleteAuth = catchAsync(async (req: Request, res: Response) => {});

export const authController = {
  createAuth: credentialsLogin,
  getNewAccessTokenUsingRefreshToken,
  logout,
  changePassword,
  getAllAuth,
  getAuthById,
  updateAuth,
  deleteAuth,
};
