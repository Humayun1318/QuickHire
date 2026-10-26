import z from 'zod';
import {
  createUserZodSchema,
  emailValidationSchema,
  passwordValidationSchema,
} from '../user/user.validation';
import { UserRole } from '../user/user.interface';

/**
 * Public self-registration. Only SEEKER and EMPLOYER may be chosen — admin
 * roles can never be self-assigned (the super admin is seeded from env).
 */
const registerSchema = createUserZodSchema.extend({
  role: z
    .enum([UserRole.SEEKER, UserRole.EMPLOYER], {
      error: 'Role must be either seeker or employer',
    })
    .default(UserRole.SEEKER),
});

const loginSchema = z.object({
  email: emailValidationSchema,
  password: z
    .string({ error: 'Password is required' })
    .min(1, 'Password is required')
    .max(128, 'Password is too long'),
});

const changePasswordSchema = z
  .object({
    oldPassword: z
      .string({ error: 'Old password is required' })
      .min(1, 'Old password is required')
      .max(128),
    newPassword: passwordValidationSchema,
  })
  .refine((data) => data.oldPassword !== data.newPassword, {
    message: 'New password must be different from the old password',
    path: ['newPassword'],
  });

export const authValidation = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
};
