import { Request } from 'express';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import {
  Strategy as GoogleStrategy,
  Profile,
  VerifyCallback,
} from 'passport-google-oauth20';
import { User } from '../modules/user/user.models';
import { envVars, isGoogleAuthEnabled } from './env';
import { AccountStatus, AuthProvider } from '../modules/user/user.interface';
import { parseOAuthState } from '../modules/auth/auth.utils';

/**
 * Passport strategies. Sessions are NOT used: both strategies are invoked
 * with custom callbacks that issue JWTs, so serializeUser/deserializeUser
 * are not needed.
 */

const INVALID_CREDENTIALS = 'Invalid email or password';

passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
      session: false,
    },
    async (email: string, password: string, done) => {
      try {
        const user = await User.findByEmail(email);

        // Same message for unknown email and wrong password, so the login
        // endpoint does not reveal which accounts exist.
        if (!user) {
          return done(null, false, { message: INVALID_CREDENTIALS });
        }

        if (!user.password && user.hasAuthProvider(AuthProvider.GOOGLE)) {
          return done(null, false, {
            message:
              'This account uses Google sign-in. Please continue with Google.',
          });
        }

        const isPasswordMatched = await user.comparePassword(password);
        if (!isPasswordMatched) {
          return done(null, false, { message: INVALID_CREDENTIALS });
        }

        // Status is only revealed after a correct password.
        if (!user.isAccountActive()) {
          return done(null, false, {
            message: `Account is ${user.status}. Contact support for assistance.`,
          });
        }

        user.lastLogin = new Date();
        await user.save();

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    },
  ),
);

if (isGoogleAuthEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: envVars.GOOGLE_CLIENT_ID as string,
        clientSecret: envVars.GOOGLE_CLIENT_SECRET as string,
        callbackURL: envVars.GOOGLE_CALLBACK_URL as string,
        passReqToCallback: true,
      },
      async (
        req: Request,
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: VerifyCallback,
      ) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) {
            return done(null, false, {
              message: 'No email address returned by Google',
            });
          }

          // Linking a Google login to an existing account by email is only
          // safe when Google has verified that email address.
          const emailVerified =
            profile.emails?.[0]?.verified ??
            (profile as Profile & { _json?: { email_verified?: boolean } })
              ._json?.email_verified;
          if (emailVerified === false) {
            return done(null, false, {
              message: 'Your Google email address is not verified',
            });
          }

          // The state was already validated (nonce) in the callback
          // controller before this strategy runs.
          const state = parseOAuthState(req.query.state);

          const user = await User.findByEmail(email);

          if (user) {
            if (!user.isAccountActive()) {
              return done(null, false, {
                message: `Account is ${user.status}`,
              });
            }

            if (!user.hasAuthProvider(AuthProvider.GOOGLE)) {
              user.auths.push({
                provider: AuthProvider.GOOGLE,
                providerId: profile.id,
              });
            }

            user.lastLogin = new Date();
            await user.save();

            return done(null, user);
          }

          const newUser = await User.create({
            email,
            // Schema limits names to 2-50 characters.
            name: (profile.displayName || email.split('@')[0])
              .slice(0, 50)
              .padEnd(2, '_'),
            avatar: profile.photos?.[0]?.value,
            role: state?.role,
            status: AccountStatus.ACTIVE,
            isVerified: true,
            auths: [
              {
                provider: AuthProvider.GOOGLE,
                providerId: profile.id,
              },
            ],
            lastLogin: new Date(),
          });

          return done(null, newUser);
        } catch (error) {
          return done(error as Error);
        }
      },
    ),
  );
}
