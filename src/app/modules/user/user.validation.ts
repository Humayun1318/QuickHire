import { z } from 'zod';
import { AccountStatus, AuthProvider, UserRole } from './user.interface';

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
  });

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
export const createUserZodSchema = z
  .object({
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

    avatar: z
      .string({
        error: (issue) =>
          issue.input === undefined
            ? 'Avatar URL is required'
            : 'Avatar must be a string',
      })
      .refine((val) => val === '' || /^https?:\/\/\S+$/.test(val), {
        message: 'Avatar must be a valid URL',
      })
      .optional()
      .nullable(),

    // role: z.enum(Object.values(UserRole) as [string, ...string[]]).optional(),

    // auths: z
    //   .array(authProviderZodSchema, {
    //     error: (issue) => {
    //       if (issue.input === undefined)
    //         return 'Authentication provider is required';
    //       return 'Auths must be an array';
    //     },
    //   })
    //   .min(1, 'At least one authentication provider is required'),
  })
  // .superRefine((data, ctx) => {
  //   if (data.auths) {
  //     const hasLocal = data.auths.some(
  //       (entry) => entry.provider === AuthProvider.LOCAL,
  //     );

  //     if (hasLocal && !data.password) {
  //       ctx.addIssue({
  //         code: 'custom',
  //         message: 'Password is required for local authentication',
  //         path: ['password'],
  //       });
  //     }

  //     if (!hasLocal && data.password) {
  //       ctx.addIssue({
  //         code: 'custom',
  //         message: 'Password should not be provided for OAuth users',
  //         path: ['password'],
  //       });
  //     }

  //     const providers = data.auths.map((entry) => entry.provider);

  //     if (new Set(providers).size !== providers.length) {
  //       ctx.addIssue({
  //         code: 'custom',
  //         message: 'Duplicate auth providers are not allowed',
  //         path: ['auths'],
  //       });
  //     }
  //   }
  // });

// ----------------------
// Update User Schema
// ----------------------
export const updateUserZodSchema = createUserZodSchema.partial().refine(
  (data) => {
    if ('email' in data && data.email === '') return false;
    if ('password' in data && data.password === '') return false;
    return true;
  },
  {
    message: 'Email and password cannot be empty strings when updating',
    path: ['email', 'password'],
  },
);
