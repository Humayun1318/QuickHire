import { z } from 'zod';
import {
  ExperienceLevel,
  JobStatus,
  JobType,
  SalaryCurrency,
  WorkMode,
} from './jobListing.constants';

// ─────────────────────────────────────────────────────────────
// Reusable sub-schemas
// ─────────────────────────────────────────────────────────────

const salarySchema = z
  .object({
    min: z.number().nonnegative().optional(),
    max: z.number().nonnegative().optional(),
    currency: z.enum(SalaryCurrency).default(SalaryCurrency.BDT),
    isNegotiable: z.boolean().default(true),
    isVisible: z.boolean().default(true),
  })
  .refine(
    (data) => {
      // If both min and max are provided, min must not exceed max
      if (data.min !== undefined && data.max !== undefined) {
        return data.min <= data.max;
      }
      return true;
    },
    { message: 'Minimum salary cannot exceed maximum salary', path: ['min'] },
  );

const locationSchema = z.object({
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
});

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

const createJobSchema = z.object({
  body: z.object({
    companyId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid company ID'),
    title: z
      .string()
      .trim()
      .min(5, 'Job title must be at least 5 characters')
      .max(150, 'Job title cannot exceed 150 characters'),
    description: z
      .string()
      .trim()
      .min(50, 'Description must be at least 50 characters'),
    categoryId: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .optional(),
    requirements: z.array(z.string().trim()).default([]),
    responsibilities: z.array(z.string().trim()).default([]),
    skills: z.array(z.string().trim()).default([]),
    type: z.enum(JobType),
    workMode: z.enum(WorkMode),
    experienceLevel: z.enum(ExperienceLevel).optional(),
    salary: salarySchema.optional(),
    location: locationSchema.optional(),
    // Employer can choose to save as draft or publish immediately
    status: z
      .enum([JobStatus.DRAFT, JobStatus.PUBLISHED])
      .default(JobStatus.DRAFT),
    expiresAt: z
      .string()
      .datetime({ message: 'Invalid expiry date' })
      .optional(),
  }),
});

// ─────────────────────────────────────────────────────────────
// Update — all fields partial
// status transitions are validated in service, not here
// ─────────────────────────────────────────────────────────────

const updateJobSchema = z.object({
  body: z
    .object({
      companyId: z
        .string()
        .regex(/^[a-f\d]{24}$/i)
        .optional(),
      title: z.string().trim().min(5).max(150).optional(),
      description: z.string().trim().min(50).optional(),
      categoryId: z
        .string()
        .regex(/^[a-f\d]{24}$/i)
        .optional(),
      requirements: z.array(z.string().trim()).optional(),
      responsibilities: z.array(z.string().trim()).optional(),
      skills: z.array(z.string().trim()).optional(),
      type: z.enum(JobType).optional(),
      workMode: z.enum(WorkMode).optional(),
      experienceLevel: z.enum(ExperienceLevel).optional(),
      salary: salarySchema.optional(),
      location: locationSchema.optional(),
      expiresAt: z.string().datetime().optional(),
    })
    .partial(),
});

// ─────────────────────────────────────────────────────────────
// Status update — separate endpoint, employer or admin
// ─────────────────────────────────────────────────────────────

const updateStatusSchema = z.object({
  body: z.object({
    companyId: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .optional(),
    status: z.enum(JobStatus),
  }),
});

// ─────────────────────────────────────────────────────────────
// Search / filter query params
// ─────────────────────────────────────────────────────────────

const jobSearchQuerySchema = z.object({
  query: z.object({
    searchTerm: z.string().optional(),
    categoryId: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .optional(),
    type: z.enum(JobType).optional(),
    workMode: z.enum(WorkMode).optional(),
    experienceLevel: z.enum(ExperienceLevel).optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    salaryMin: z.string().regex(/^\d+$/).optional(),
    salaryMax: z.string().regex(/^\d+$/).optional(),
    isFeatured: z.enum(['true', 'false']).optional(),
    companyId: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .optional(),
    page: z.string().regex(/^\d+$/).default('1'),
    limit: z.string().regex(/^\d+$/).default('20'),
    sortBy: z.enum(['newest', 'salary', 'relevance']).default('newest'),
  }),
});

export const jobListingValidation = {
  createJobSchema,
  updateJobSchema,
  updateStatusSchema,
  jobSearchQuerySchema,
};
