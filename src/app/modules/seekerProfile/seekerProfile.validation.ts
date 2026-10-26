import { z } from 'zod';
import {
  AvailabilityStatus,
  JobPreferenceType,
  SalaryCurrency,
} from './seekerProfile.constants';
import { addressSchemaValidation } from '../../shared/validation/address.validation';
import { socialLinksSchemaValidation } from '../../shared/validation/socialLinks.validation';
import { objectIdString } from '../../shared/validation/common.validation';

// ─────────────────────────────────────────────────────────────
// Reusable sub-schemas
// ─────────────────────────────────────────────────────────────

const expectedSalarySchema = z
  .object({
    amount: z.number().nonnegative('Salary cannot be negative'),
    currency: z.enum(SalaryCurrency).default(SalaryCurrency.BDT),
    isNegotiable: z.boolean().default(true),
  })
  .nullable();

// ─────────────────────────────────────────────────────────────
// Create — all optional except userId is taken from JWT (req.user)
// ─────────────────────────────────────────────────────────────

const createSeekerProfileSchema = z.object({
  headline: z
    .string()
    .trim()
    .max(120, 'Headline cannot exceed 120 characters')
    .optional(),
  bio: z
    .string()
    .trim()
    .max(1000, 'Bio cannot exceed 1000 characters')
    .optional(),
  address: addressSchemaValidation.optional(),
  skills: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  languages: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  expectedSalary: expectedSalarySchema.optional(),
  jobPreference: z.enum(JobPreferenceType).optional(),
  availabilityStatus: z
    .enum(AvailabilityStatus)
    .default(AvailabilityStatus.OPEN),
  socialLinks: socialLinksSchemaValidation.optional(),
});

// ─────────────────────────────────────────────────────────────
// Update — all fields partial, no required fields
// ─────────────────────────────────────────────────────────────

const updateSeekerProfileSchema = z
  .object({
    headline: z.string().trim().max(120).optional(),
    bio: z.string().trim().max(1000).optional(),
    address: addressSchemaValidation.optional(),
    skills: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
    languages: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
    expectedSalary: expectedSalarySchema.optional(),
    jobPreference: z.enum(JobPreferenceType).optional(),
    availabilityStatus: z.enum(AvailabilityStatus).optional(),
    socialLinks: socialLinksSchemaValidation.optional(),
  })
  .partial();

// GET /seeker-profiles?profileId=...&active=...&page=...&limit=...
const profileQuerySchema = z.object({
  profileId: objectIdString('Invalid profile ID').optional(),
  active: z.enum(['true', 'false']).optional(),
  page: z.string().regex(/^\d+$/, 'Must be a whole number').optional(),
  limit: z.string().regex(/^\d+$/, 'Must be a whole number').optional(),
});

export const seekerProfileValidation = {
  createSeekerProfileSchema,
  updateSeekerProfileSchema,
  profileQuerySchema,
};
