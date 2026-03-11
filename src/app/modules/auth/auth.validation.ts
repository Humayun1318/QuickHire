import z, { email } from 'zod';
import {
  emailValidationSchema,
  passwordValidationSchema,
} from '../user/user.validation';

const loginSchema = z.object({
  email: emailValidationSchema,
  password: passwordValidationSchema,
});

export const authValidation = {
  loginSchema,
};
