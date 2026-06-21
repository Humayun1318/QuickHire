import z, { email } from 'zod';
import {
  emailValidationSchema,
} from '../user/user.validation';

const loginSchema = z.object({
  email: emailValidationSchema,
  password: z.string(),
});

export const authValidation = {
  loginSchema,
};
