import { z } from 'zod';
import { AccountStatus, AuthProvider, UserRole } from './user.interface';
import { queryBuilderSchema } from '../../shared/validation/queryBuilderSchema';

export const passwordValidationSchema = z
  .string({
    error: (issue) =>
      issue.input === undefined
        ? 'Password is required'
        : 'Password must be a string',
  })
  .min(8, { message: 'Password must be at least 8 characters long' })
  // bcrypt only uses the first 72 bytes of the input; longer passwords would
  // be silently truncated.
  .refine((val) => Buffer.byteLength(val, 'utf8') <= 72, {
    message: 'Password must not exceed 72 bytes',
  })
  .refine((val) => /[A-Z]/.test(val), {
    message: 'Password must contain at least one uppercase letter',
  })
  .refine((val) => /[a-z]/.test(val), {
    message: 'Password must contain at least one lowercase letter',
  })
  .refine((val) => /\d/.test(val), {
    message: 'Password must contain at least one number',
  })
  .refine((val) => /[@$!%*?&]/.test(val), {
    message: 'Password must contain at least one special character (@$!%*?&)',
  });

export const emailValidationSchema = z
  .string({
    error: (issue) =>
      issue.input === undefined
        ? 'Email is required'
        : 'Email must be a string',
  })
  .trim()
  .max(254, 'Email is too long')
  .superRefine((val, ctx) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(val)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid email format',
      });
    }
  })
  .transform((val) => val.toLowerCase());

// ----------------------
// Auth Provider Schema
// ----------------------
export const authProviderZodSchema = z.object({
  provider: z.enum(Object.values(AuthProvider) as [string, ...string[]]),

  providerId: z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? 'Provider ID is required'
          : 'Provider ID must be a string',
    })
    .trim()
    .min(1, 'Provider ID cannot be empty'),
});

// ----------------------
// Create User Schema (base for registration — see auth.validation.ts, which
// adds the restricted `role` field)
// ----------------------
export const createUserZodSchema = z.object({
  name: z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? 'Name is required'
          : 'Name must be a string',
    })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name cannot exceed 50 characters'),

  email: emailValidationSchema,

  password: passwordValidationSchema,

  phone: z
    .string({ error: 'Phone must be a string' })
    .trim()
    .min(10, 'Phone must be at least 10 digits')
    .max(15, 'Phone number too long')
    .regex(
      /^\+?[\d\s()-]+$/,
      'Phone may only contain digits, spaces, +, -, ( )',
    )
    .optional()
    .nullable(),

  avatar: z
    .string({ error: 'Avatar must be a string' })
    .trim()
    .max(2048, 'Avatar URL is too long')
    .refine((val) => val === '' || /^https?:\/\/\S+$/.test(val), {
      message: 'Avatar must be a valid URL',
    })
    .optional()
    .nullable(),
});

// ----------------------
// Admin user list query (GET /users)
// ----------------------
export const userQuerySchema = queryBuilderSchema
  .extend({
    role: z.enum(Object.values(UserRole) as [string, ...string[]]).optional(),
    status: z
      .enum(Object.values(AccountStatus) as [string, ...string[]])
      .optional(),
    isVerified: z.enum(['true', 'false']).optional(),
  })
  .strict();
