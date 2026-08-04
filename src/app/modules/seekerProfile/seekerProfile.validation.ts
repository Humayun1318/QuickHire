import { z } from 'zod';
import {
  AvailabilityStatus,
  JobPreferenceType,
  SalaryCurrency,
} from './seekerProfile.constants';
import { addressSchemaValidation } from '../../shared/validation/address.validation';
import { socialLinksSchemaValidation } from '../../shared/validation/socialLinks.validation';

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
  skills: z.array(z.string().trim()).default([]),
  languages: z.array(z.string().trim()).default([]),
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
    skills: z.array(z.string().trim()).optional(),
    languages: z.array(z.string().trim()).default([]),
    expectedSalary: expectedSalarySchema.optional(),
    jobPreference: z.enum(JobPreferenceType).optional(),
    availabilityStatus: z.enum(AvailabilityStatus).optional(),
    socialLinks: socialLinksSchemaValidation.optional(),
  })
  .partial();

export const seekerProfileValidation = {
  createSeekerProfileSchema,
  updateSeekerProfileSchema,
};
