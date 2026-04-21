import { envVars } from '../config/env';
import {
  AuthProvider,
  IAuthProvider,
  IUser,
  Role,
} from '../modules/user/user.interface';
import { User } from '../modules/user/user.models';


export const seedSuperAdmin = async () => {
  try {
    const isSuperAdminExist = await User.findOne({
      email: envVars.SUPER_ADMIN_EMAIL,
    });

    if (isSuperAdminExist) {
      console.log('Super Admin Already Exists!');
      return;
    }

    console.log('Trying to create Super Admin...');

    // password should be stored in plaintext here; the schema's pre-save hook
    // will hash it automatically. Hashing it ourselves would double-hash and
    // cause bcrypt.compare to fail later.

    const authProvider: IAuthProvider = {
      provider: AuthProvider.CREDENTIALS,
      providerId: envVars.SUPER_ADMIN_EMAIL,
    };

    const payload: Pick<
      IUser,
      'name' | 'role' | 'email' | 'password' | 'isVerified' | 'auths'
    > = {
      name: 'Super admin',
      role: Role.SUPER_ADMIN,
      email: envVars.SUPER_ADMIN_EMAIL,
      password: envVars.SUPER_ADMIN_PASSWORD, // let mongoose hash in pre-save
      isVerified: true,
      auths: [authProvider],
    };

    const superadmin = await User.create(payload);
    console.log('Super Admin Created Successfuly! \n');
  } catch (error) {
    console.log(error);
  }
};
