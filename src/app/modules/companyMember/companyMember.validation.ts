import { z } from 'zod';
import { CompanyMemberRole } from './companyMember.constants';

// Add member — employer or admin provides userId and role
const addMemberSchemaValidation = z.object({
  companyId: z
    .string()
    .min(1, 'Company ID is required')
    .regex(/^[a-f\d]{24}$/i, 'Invalid company ID format'),
  userId: z
    .string()
    .min(1, 'User ID is required')
    .regex(/^[a-f\d]{24}$/i, 'Invalid user ID format'),
  // OWNER cannot be assigned via this endpoint — only set on company creation
  role: z
    .enum(CompanyMemberRole)
    .refine((role) => role !== CompanyMemberRole.OWNER, {
      message: 'Cannot assign OWNER role. Owner is set on company creation.',
    }),
});

// Update role — only role can be changed, not userId or companyId
const updateMemberRoleSchemaValidation = z.object({
  companyId: z
    .string()
    .min(1, 'Company ID is required')
    .regex(/^[a-f\d]{24}$/i, 'Invalid company ID format'),
  role: z
    .enum(CompanyMemberRole)
    .refine((role) => role !== CompanyMemberRole.OWNER, {
      message: 'Cannot change role to OWNER.',
    }),
});

export const companyMemberValidation = {
  addMemberSchemaValidation,
  updateMemberRoleSchemaValidation,
};
