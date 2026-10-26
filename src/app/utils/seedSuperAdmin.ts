import { envVars } from '../config/env';
import {
  AuthProvider,
  IAuthEntry,
  IUser,
  UserRole,
} from '../modules/user/user.interface';
import { User } from '../modules/user/user.models';

/**
 * Creates the super admin account from SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD
 * if it does not exist yet. Runs once per process after the DB connects.
 * Failures are logged but never crash the app — the API stays usable.
 */
export const seedSuperAdmin = async () => {
  try {
    const isSuperAdminExist = await User.exists({
      email: envVars.SUPER_ADMIN_EMAIL,
    });

    if (isSuperAdminExist) {
      return;
    }

    const authProvider: IAuthEntry = {
      provider: AuthProvider.LOCAL,
      providerId: envVars.SUPER_ADMIN_EMAIL,
    };

    const payload: Pick<
      IUser,
      'name' | 'role' | 'email' | 'password' | 'isVerified' | 'auths'
    > = {
      name: 'Super admin',
      role: UserRole.SUPER_ADMIN,
      email: envVars.SUPER_ADMIN_EMAIL,
      password: envVars.SUPER_ADMIN_PASSWORD, // hashed by the pre-save hook
      isVerified: true,
      auths: [authProvider],
    };

    await User.create(payload);
    console.log('Super admin created');
  } catch (error) {
    // A concurrent cold start may have created it first (duplicate key).
    if ((error as { code?: number }).code === 11000) return;
    console.error('Super admin seeding failed:', (error as Error).message);
  }
};
