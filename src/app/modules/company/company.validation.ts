import { z } from 'zod';
import {
  CompanyIndustry,
  CompanySize,
  CompanyVerificationStatus,
} from './company.constants';
import { addressSchemaValidation } from '../../shared/validation/address.validation';
import { socialLinksSchemaValidation } from '../../shared/validation/socialLinks.validation';

// ─────────────────────────────────────────────────────────────
// Create — name is the only required field on creation
// Everything else can be filled in the update flow
// ─────────────────────────────────────────────────────────────

const createCompanySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Company name must be at least 2 characters')
    .max(100, 'Company name cannot exceed 100 characters'),
  description: z.string().trim().max(2000).optional(),
  industry: z.enum(CompanyIndustry).optional(),
  size: z.enum(CompanySize).optional(),
  website: z.url({ error: 'Invalid website URL' }).optional(),
  address: addressSchemaValidation.optional(),
  socialLinks: socialLinksSchemaValidation.optional(),
});

// ─────────────────────────────────────────────────────────────
// Update — all fields partial
// ownerId, slug, verificationStatus cannot be changed by employer
// ─────────────────────────────────────────────────────────────

const updateCompanySchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(2000).optional(),
    industry: z.enum(CompanyIndustry).optional(),
    size: z.enum(CompanySize).optional(),
    website: z.url({ error: 'Invalid website URL' }).optional(),
    address: addressSchemaValidation.optional(),
    socialLinks: socialLinksSchemaValidation.optional(),
    logo: z.url({ error: 'Invalid logo URL' }).optional(),
    banner: z.url({ error: 'Invalid banner URL' }).optional(),
  })
  .partial();

// Admin-only — update verification status with optional note
const updateVerificationSchema = z.object({
  verificationStatus: z.enum(CompanyVerificationStatus),
  verificationNote: z.string().trim().optional(),
});

export const companyValidation = {
  createCompanySchema,
  updateCompanySchema,
  updateVerificationSchema,
};
