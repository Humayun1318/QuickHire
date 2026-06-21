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
import { validateUserStatus } from '../../utils/validateUserStatus';

const createUser = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.createUser(req.body);

  // Send success response to client with created user data
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'User created successfully',
    data: result,
  });
});

const credentialsLogin = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {

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
    passport.authenticate(
      'google',
      (err:any, user:any, info:any) => {
        try {
          // ERROR CASE
          if (err) {
            return res.redirect(
              `${envVars.FRONTEND_URL}/login?error=${encodeURIComponent(
                err || 'Internal google strategy error',
              )}`,
            );
          }

          // AUTH FAILED CASE
          if (!user) {
            const message =
              info?.message || 'Authentication failed';

            return res.redirect(
              `${envVars.FRONTEND_URL}/login?error=${encodeURIComponent(
                message,
              )}`,
            );
          }

          // SUCCESS CASE
          req.user = user;

          // ───── STATE HANDLING ─────
          let redirectTo = '';

          if (req.query.state && typeof req.query.state === 'string') {
            try {
              const parsed = JSON.parse(req.query.state);
              if (parsed?.redirect) {
                redirectTo = parsed.redirect;
              }
            } catch {
              redirectTo = '';
            }
          }

          if (redirectTo.startsWith('/')) {
            redirectTo = redirectTo.slice(1);
          }

          // ───── TOKEN + COOKIE ─────
          const tokenInfo = createUserTokens(user);
          setAuthCookie(res, tokenInfo);

          // ───── FINAL REDIRECT ─────
          return res.redirect(
            `${envVars.FRONTEND_URL}/${redirectTo}`,
          );
        } catch (error) {
          next(error);
        }
      },
    )(req, res, next);
  },
);
const getAllAuth = catchAsync(async (req: Request, res: Response) => { });
const getAuthById = catchAsync(async (req: Request, res: Response) => { });
const updateAuth = catchAsync(async (req: Request, res: Response) => { });
const deleteAuth = catchAsync(async (req: Request, res: Response) => { });

export const authController = {
  createUser,
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
