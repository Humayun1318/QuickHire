import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import {
  Strategy as GoogleStrategy,
  Profile,
  VerifyCallback,
} from 'passport-google-oauth20';
import { User } from '../modules/user/user.models';
import { envVars } from './env';
import { AccountStatus, AuthProvider, UserRole } from '../modules/user/user.interface';

passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email: string, password: string, done) => {
      try {
        const user = await User.findByEmail(email);

        // ─────────────────────────────
        //  USER NOT FOUND
        // ─────────────────────────────
        if (!user) {
          return done(null, false, {
            message: 'User does not exist',
          });
        }

        // ─────────────────────────────
        // VERIFICATION CHECK
        // ─────────────────────────────
        // if (!user.isVerified) {
        //   return done(null, false, {
        //     message: 'User is not verified',
        //   });
        // }

        // ─────────────────────────────
        // STATUS CHECK (model method)
        // ─────────────────────────────
        if (!user.isAccountActive()) {
          return done(null, false, {
            message: `User is ${user.status}`,
          });
        }

        // ─────────────────────────────
        // SOFT DELETE CHECK 
        // ─────────────────────────────
        // if ((user as any).isDeleted) {
        //   return done(null, false, {
        //     message: 'User is deleted',
        //   });
        // }

        // ─────────────────────────────
        //  GOOGLE + PASSWORD CONFLICT LOGIC
        // ─────────────────────────────
        const hasGoogleAuth = user.hasAuthProvider(AuthProvider.GOOGLE);

        if (hasGoogleAuth && !user.password) {
          return done(null, false, {
            message:
              'You registered with Google. Please login with Google first and set a password to enable credentials login.',
          });
        }

        // ─────────────────────────────
        // PASSWORD CHECK
        // ─────────────────────────────
        const isPasswordMatched = await user.comparePassword(password);

        if (!isPasswordMatched) {
          return done(null, false, {
            message: 'Password does not match',
          });
        }

        // ─────────────────────────────
        // SUCCESS
        // ─────────────────────────────
        return done(null, user);
      } catch (error) {
        console.log('Local Strategy Error:', error);
        return done(error);
      }
    },
  ),
);


passport.use(
  new GoogleStrategy(
    {
      clientID: envVars.GOOGLE_CLIENT_ID,
      clientSecret: envVars.GOOGLE_CLIENT_SECRET,
      callbackURL: envVars.GOOGLE_CALLBACK_URL,
    },
    async (
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done: VerifyCallback,
    ) => {
      try {
        const email = profile.emails?.[0]?.value;

        if (!email) {
          return done(null, false, { message: 'No email found' });
        }

        let user = await User.findByEmail(email);

        // ─────────────────────────────
        //  USER EXISTS
        // ─────────────────────────────
        if (user) {
          //  not verified user
          if (!user.isVerified) {
            return done(null, false, {
              message: 'User is not verified',
            });
          }

          //  inactive / blocked via model method
          if (!user.isAccountActive()) {
            return done(null, false, {
              message: `User is ${user.status}`,
            });
          }

          // soft deleted (if you have this field in model)
          // if (user.isDeleted) {
          //   return done(null, false, {
          //     message: 'User is deleted',
          //   });
          // }

          // link google auth if not exists
          if (!user.hasAuthProvider(AuthProvider.GOOGLE)) {
            user.auths.push({
              provider: AuthProvider.GOOGLE,
              providerId: profile.id,
            });
          }

          // update login info
          user.lastLogin = new Date();
          await user.save();

          return done(null, user);
        }

        // ─────────────────────────────
        //  NEW USER
        // ─────────────────────────────
        const newUser = await User.create({
          email,
          name: profile.displayName,
          avatar: profile.photos?.[0]?.value,
          role: UserRole.SEEKER,
          status: AccountStatus.ACTIVE,

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
        console.log('Google Strategy Error', error);
        return done(error);
      }
    },
  ),
);


passport.serializeUser((user: any, done: (err: any, id?: unknown) => void) => {
    done(null, user._id)
})

passport.deserializeUser(async (id: string, done: any) => {
    try {
        const user = await User.findById(id);
        done(null, user)
    } catch (error) {
        console.log(error);
        done(error)
    }
})