import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { authService } from './auth.service';
import { sendResponse } from '../../utils/sendResponse';
import httpStatus from 'http-status-codes';
import { setAuthCookie } from '../../utils/setAuthCookie';
import { envVars } from '../../config/env';
import { JwtPayload } from 'jsonwebtoken';
import passport from 'passport';
import AppError from '../../errorHelpers/AppError';
import { createUserTokens } from '../../utils/userTokens';

const credentialsLogin = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // const loginInfo = await authService.createAuth(req.body);

    // // Set access and refresh tokens in HTTP-only cookies
    // setAuthCookie(res, loginInfo);

    // sendResponse(res, {
    //   statusCode: httpStatus.OK,
    //   success: true,
    //   message: 'Login successfully',
    //   data: loginInfo,
    // });
    // -------------using passport to credentials login-----------------------
    passport.authenticate('local', async (err: any, user: any, info: any) => {
      if (err) {
        // ❌❌❌❌❌
        // throw new AppError(401, "Some error")
        // next(err)
        // return new AppError(401, err)

        // ✅✅✅✅
        // return next(err)
        // console.log("from err");
        return next(new AppError(401, err));
      }

      if (!user) {
        // console.log("from !user");
        // return new AppError(401, info.message)
        return next(new AppError(401, info.message));
      }

      //generate tokens
      const userTokens = createUserTokens(user);

      //set cookies in browser
      setAuthCookie(res, userTokens);

      sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'User Logged In Successfully',
        data: {
          accessToken: userTokens.accessToken,
          refreshToken: userTokens.refreshToken,
          user: user,
        },
      });
    })(req, res, next);
  },
);

const getNewAccessTokenUsingRefreshToken = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
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
    await authService.changePassword(req.body, (req.user as JwtPayload).email);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Password Changed Successfully',
      data: null,
    });
  },
);
const googleCallbackController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    let redirectTo = req.query.state ? (req.query.state as string) : '';

    if (redirectTo.startsWith('/')) {
      redirectTo = redirectTo.slice(1);
    }

    // /booking => booking , => "/" => ""
    const user = req.user as any;

    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'User Not Found');
    }

    const tokenInfo = createUserTokens(user);

    setAuthCookie(res, tokenInfo);

    // sendResponse(res, {
    //     success: true,
    //     statusCode: httpStatus.OK,
    //     message: "Password Changed Successfully",
    //     data: null,
    // })

    res.redirect(`${envVars.FRONTEND_URL}/${redirectTo}`);
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
  googleCallbackController,
  getAllAuth,
  getAuthById,
  updateAuth,
  deleteAuth,
};
