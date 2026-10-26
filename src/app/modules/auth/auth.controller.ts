import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { authService } from './auth.service';
import { sendResponse } from '../../utils/sendResponse';
import httpStatus from 'http-status-codes';
import { clearAuthCookies, setAuthCookie } from '../../utils/setAuthCookie';
import { envVars, isGoogleAuthEnabled } from '../../config/env';
import passport from 'passport';
import AppError from '../../errorHelpers/AppError';
import { createUserTokens } from '../../utils/userTokens';
import { getUserIdFromReq } from '../../utils/getUserIdFromReq';
import { IUser } from '../user/user.interface';
import {
  createOAuthState,
  isNonceMatch,
  OAUTH_STATE_COOKIE,
  oauthStateCookieOptions,
  parseOAuthState,
} from './auth.utils';

const createUser = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.createUser(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'User created successfully',
    data: result,
  });
});

/**
 * Email + password login via the passport local strategy (no session).
 * Returns the tokens in the body and also sets them as httpOnly cookies.
 */
const credentialsLogin = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate(
    'local',
    { session: false },
    (err: unknown, user: IUser | false, info?: { message?: string }) => {
      if (err) {
        // Unexpected failure (e.g. database error) -> 500 via error handler
        return next(err);
      }

      if (!user) {
        return next(
          new AppError(
            httpStatus.UNAUTHORIZED,
            info?.message || 'Invalid email or password',
          ),
        );
      }

      const userTokens = createUserTokens(user);
      setAuthCookie(res, userTokens);

      sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'User logged in successfully',
        data: {
          accessToken: userTokens.accessToken,
          refreshToken: userTokens.refreshToken,
          user,
        },
      });
    },
  )(req, res, next);
};

/**
 * Issues a new access token. The refresh token is read from the httpOnly
 * cookie, or from the JSON body for non-browser clients.
 */
const getNewAccessTokenUsingRefreshToken = catchAsync(
  async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken ?? req.body?.refreshToken;

    const tokenInfo =
      await authService.getNewAccessTokenUsingRefreshToken(refreshToken);

    setAuthCookie(res, tokenInfo);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'New access token retrieved successfully',
      data: tokenInfo,
    });
  },
);

/**
 * Clears the auth cookies. JWTs are stateless, so tokens that a client kept
 * elsewhere remain valid until they expire (see docs/SECURITY.md).
 */
const logout = catchAsync(async (_req: Request, res: Response) => {
  clearAuthCookies(res);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'User logged out successfully',
    data: null,
  });
});

/**
 * Changes the password and rotates tokens: every other session is
 * invalidated, the current client receives fresh tokens.
 */
const changePassword = catchAsync(async (req: Request, res: Response) => {
  const user = await authService.changePassword(
    req.body,
    getUserIdFromReq(req),
  );

  const tokens = createUserTokens(user);
  setAuthCookie(res, tokens);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'Password changed successfully',
    data: tokens,
  });
});

const ensureGoogleEnabled = () => {
  if (!isGoogleAuthEnabled) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      'Google sign-in is not configured on this server',
    );
  }
};

/**
 * Starts the Google OAuth flow. Query params:
 *   role     - seeker | employer (only used when a new account is created)
 *   redirect - frontend path to return to after login (relative path only)
 */
const googleLogin = (req: Request, res: Response, next: NextFunction) => {
  try {
    ensureGoogleEnabled();
  } catch (error) {
    return next(error);
  }

  const { nonce, state } = createOAuthState(req.query);
  res.cookie(OAUTH_STATE_COOKIE, nonce, oauthStateCookieOptions());

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state,
    session: false,
  })(req, res, next);
};

const redirectToFrontendLogin = (res: Response, message: string) =>
  res.redirect(
    `${envVars.FRONTEND_URL}/login?error=${encodeURIComponent(message)}`,
  );

/**
 * Google OAuth callback: verifies the state nonce, runs the Google strategy,
 * sets the auth cookies and redirects to the frontend.
 */
const googleCallbackController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    ensureGoogleEnabled();
  } catch (error) {
    return next(error);
  }

  const state = parseOAuthState(req.query.state);
  const expectedNonce = req.cookies?.[OAUTH_STATE_COOKIE];
  const { maxAge: _maxAge, ...clearOptions } = oauthStateCookieOptions();
  res.clearCookie(OAUTH_STATE_COOKIE, clearOptions);

  if (!state || !isNonceMatch(expectedNonce, state.n)) {
    return redirectToFrontendLogin(
      res,
      'Login session expired or is invalid. Please try again.',
    );
  }

  passport.authenticate(
    'google',
    { session: false },
    (err: unknown, user: IUser | false, info?: { message?: string }) => {
      if (err) {
        console.error('Google OAuth error:', err);
        return redirectToFrontendLogin(res, 'Google sign-in failed');
      }

      if (!user) {
        return redirectToFrontendLogin(
          res,
          info?.message || 'Authentication failed',
        );
      }

      const tokenInfo = createUserTokens(user);
      setAuthCookie(res, tokenInfo);

      // state.redirect is sanitized to a relative path, so the redirect can
      // only ever target the configured frontend origin.
      return res.redirect(`${envVars.FRONTEND_URL}${state.redirect}`);
    },
  )(req, res, next);
};

export const authController = {
  createUser,
  credentialsLogin,
  getNewAccessTokenUsingRefreshToken,
  logout,
  changePassword,
  googleLogin,
  googleCallbackController,
};
