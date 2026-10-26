import { z } from 'zod';
import {
  CompanyIndustry,
  CompanySize,
  CompanyVerificationStatus,
} from './company.constants';
import { addressSchemaValidation } from '../../shared/validation/address.validation';
import { socialLinksSchemaValidation } from '../../shared/validation/socialLinks.validation';
import {
  httpUrl,
  objectIdString,
} from '../../shared/validation/common.validation';

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
  website: httpUrl('Invalid website URL').optional(),
  address: addressSchemaValidation.optional(),
  socialLinks: socialLinksSchemaValidation.optional(),
});

// ─────────────────────────────────────────────────────────────
// Update — all fields partial
// ownerId, slug, verificationStatus cannot be changed by employer
// (unknown keys are stripped by z.object)
// ─────────────────────────────────────────────────────────────

const updateCompanySchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(2000).optional(),
  industry: z.enum(CompanyIndustry).optional(),
  size: z.enum(CompanySize).optional(),
  website: httpUrl('Invalid website URL').optional(),
  address: addressSchemaValidation.optional(),
  socialLinks: socialLinksSchemaValidation.optional(),
  logo: httpUrl('Invalid logo URL').optional(),
  banner: httpUrl('Invalid banner URL').optional(),
});

// Admin-only — update verification status with optional note
const updateVerificationSchema = z.object({
  verificationStatus: z.enum(CompanyVerificationStatus),
  verificationNote: z.string().trim().max(500).optional(),
});

// GET /companies?companyId=... or ?slug=...
const companyIdentifierQuerySchema = z
  .object({
    companyId: objectIdString('Invalid company ID').optional(),
    slug: z.string().trim().min(1).max(120).optional(),
  })
  .refine((query) => query.companyId || query.slug, {
    message: 'Provide either companyId or slug',
  });

export const companyValidation = {
  createCompanySchema,
  updateCompanySchema,
  updateVerificationSchema,
  companyIdentifierQuerySchema,
};
