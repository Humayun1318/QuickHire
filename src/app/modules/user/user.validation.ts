import { z } from 'zod';
import { Role, IsActive, AuthProvider } from './user.interface';

export const passwordValidationSchema = z
  .string({
    error: (issue) =>
      issue.input === undefined
        ? 'Password is required'
        : 'Password must be a string',
  })
  .min(8, { message: 'Password must be at least 8 characters long' })
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
    message: 'Password must contain at least one special character',
  })
  .optional();

export const emailValidationSchema = z
  .string({
    error: (issue) =>
      issue.input === undefined
        ? 'Email is required'
        : 'Email must be a string',
  })
  .trim()
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
// Create User Schema
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
    .string({
      error: (issue) =>
        issue.input === undefined
          ? 'Phone number is required'
          : 'Phone must be a string',
    })
    .min(10, 'Phone must be at least 10 digits')
    .max(15, 'Phone number too long')
    .optional(),

  picture: z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? 'Picture URL is required'
          : 'Picture must be a string',
    })
    .refine((val) => val === '' || /^https?:\/\/\S+$/.test(val), {
      message: 'Picture must be a valid URL',
    })
    .optional(),

  address: z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? 'Address is required'
          : 'Address must be a string',
    })
    .max(200, 'Address cannot exceed 200 characters')
    .optional(),

  role: z.enum(Object.values(Role) as [string, ...string[]]).optional(),

  skills: z
    .array(
      z
        .string({
          error: (issue) =>
            issue.input === undefined
              ? 'Skill is required'
              : 'Skill must be a string',
        })
        .trim()
        .min(2, 'Skill must contain at least 2 characters')
        .transform((val) => val.toLowerCase()),
    )
    .min(1, 'At least one skill is required')
    .optional(),

  experience: z
    .number({
      error: (issue) =>
        issue.input === undefined
          ? 'Experience is required'
          : 'Experience must be a number',
    })
    .min(0, 'Experience cannot be negative')
    .optional(),

  resume: z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? 'Resume URL is required'
          : 'Resume must be a string',
    })
    .refine((val) => val === '' || /^https?:\/\/\S+$/.test(val), {
      message: 'Resume must be a valid URL',
    })
    .optional(),

  appliedJobs: z
    .array(
      z.string({
        error: (issue) =>
          issue.input === undefined
            ? 'Applied Job ID is required'
            : 'Applied Job ID must be a string',
      }),
    )
    .optional(),

  isDeleted: z.boolean().optional(),

  isActive: z.enum(Object.values(IsActive) as [string, ...string[]]).optional(),

  isVerified: z.boolean().optional(),

  auths: z
    .array(authProviderZodSchema, {
      error: (issue) => {
        if (issue.input === undefined)
          return 'Authentication provider is required';
        return 'Auths must be an array';
      },
    })
    .min(1, 'At least one authentication provider is required')
    .optional(),
});

// ----------------------
// Update User Schema
// ----------------------
// All fields optional for partial update
export const updateUserZodSchema = createUserZodSchema.partial().refine(
  (data) => {
    // Prevent empty string email/password on update
    if ('email' in data && data.email === '') return false;
    if ('password' in data && data.password === '') return false;
    return true;
  },
  {
    message: 'Email and password cannot be empty strings when updating',
    path: ['email', 'password'],
  },
);
