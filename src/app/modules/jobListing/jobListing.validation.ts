import { z } from 'zod';
import {
  ExperienceLevel,
  JobStatus,
  JobType,
  SalaryCurrency,
  WorkMode,
} from './jobListing.constants';

const objectId = (message: string) =>
  z
    .string()
    .trim()
    .regex(/^[a-f\d]{24}$/i, message);

/**
 * Early versions of this API expected job payloads wrapped as
 * `{ "body": { ...fields } }`. Both shapes are accepted: a lone `body`
 * object is unwrapped before validation, so flat payloads are the documented
 * contract while old clients keep working.
 */
const unwrapLegacyBody = (input: unknown) => {
  if (
    input &&
    typeof input === 'object' &&
    'body' in input &&
    Object.keys(input).length === 1 &&
    typeof (input as { body: unknown }).body === 'object'
  ) {
    return (input as { body: unknown }).body;
  }
  return input;
};

const futureDate = z.iso
  .datetime({ message: 'Invalid expiry date (ISO 8601 expected)' })
  .refine((value) => new Date(value) > new Date(), {
    message: 'Expiry date must be in the future',
  });

const stringList = (itemMax: number, listMax: number) =>
  z.array(z.string().trim().min(1).max(itemMax)).max(listMax);

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
      if (data.min !== undefined && data.max !== undefined) {
        return data.min <= data.max;
      }
      return true;
    },
    { message: 'Minimum salary cannot exceed maximum salary', path: ['min'] },
  );

const locationSchema = z.object({
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
});

const jobFields = {
  title: z
    .string()
    .trim()
    .min(5, 'Job title must be at least 5 characters')
    .max(150, 'Job title cannot exceed 150 characters'),
  description: z
    .string()
    .trim()
    .min(50, 'Description must be at least 50 characters')
    .max(10000, 'Description cannot exceed 10000 characters'),
  categoryId: objectId('Invalid category ID'),
  requirements: stringList(500, 50),
  responsibilities: stringList(500, 50),
  skills: stringList(50, 50),
  type: z.enum(JobType),
  workMode: z.enum(WorkMode),
  experienceLevel: z.enum(ExperienceLevel),
  salary: salarySchema,
  location: locationSchema,
  expiresAt: futureDate,
};

const createJobSchema = z.preprocess(
  unwrapLegacyBody,
  z.object({
    companyId: objectId('Invalid company ID'),
    title: jobFields.title,
    description: jobFields.description,
    categoryId: jobFields.categoryId.optional(),
    requirements: jobFields.requirements.default([]),
    responsibilities: jobFields.responsibilities.default([]),
    skills: jobFields.skills.default([]),
    type: jobFields.type,
    workMode: jobFields.workMode,
    experienceLevel: jobFields.experienceLevel.optional(),
    salary: jobFields.salary.optional(),
    location: jobFields.location.optional(),
    status: z
      .enum([JobStatus.DRAFT, JobStatus.PUBLISHED])
      .default(JobStatus.DRAFT),
    expiresAt: jobFields.expiresAt.optional(),
  }),
);

// The owning company is derived from the job itself; a companyId sent by
// older clients is accepted and ignored. Status changes go through
// PATCH /jobs/:jobId/status.
const updateJobSchema = z.preprocess(
  unwrapLegacyBody,
  z.object({
    companyId: objectId('Invalid company ID').optional(),
    title: jobFields.title.optional(),
    description: jobFields.description.optional(),
    categoryId: jobFields.categoryId.optional(),
    requirements: jobFields.requirements.optional(),
    responsibilities: jobFields.responsibilities.optional(),
    skills: jobFields.skills.optional(),
    type: jobFields.type.optional(),
    workMode: jobFields.workMode.optional(),
    experienceLevel: jobFields.experienceLevel.optional(),
    salary: jobFields.salary.optional(),
    location: jobFields.location.optional(),
    expiresAt: jobFields.expiresAt.optional(),
  }),
);

const updateStatusSchema = z.preprocess(
  unwrapLegacyBody,
  z.object({
    companyId: objectId('Invalid company ID').optional(),
    status: z.enum(JobStatus),
  }),
);

const toggleFeaturedSchema = z.object({
  isFeatured: z.boolean({ error: 'isFeatured must be a boolean' }),
});

const numericString = z.string().regex(/^\d+$/, 'Must be a whole number');

// Public search — query strings only; unknown params are ignored.
const jobSearchQuerySchema = z.object({
  searchTerm: z.string().trim().max(100).optional(),
  categoryId: objectId('Invalid category ID').optional(),
  type: z.enum(JobType).optional(),
  workMode: z.enum(WorkMode).optional(),
  experienceLevel: z.enum(ExperienceLevel).optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  salaryMin: numericString.optional(),
  salaryMax: numericString.optional(),
  isFeatured: z.enum(['true', 'false']).optional(),
  companyId: objectId('Invalid company ID').optional(),
  page: numericString.optional(),
  limit: numericString.optional(),
  sortBy: z.enum(['newest', 'salary', 'relevance']).optional(),
});

// Company dashboard listing — members may filter by any status.
const companyJobsQuerySchema = z.object({
  status: z.enum(JobStatus).optional(),
  page: numericString.optional(),
  limit: numericString.optional(),
});

export const jobListingValidation = {
  createJobSchema,
  updateJobSchema,
  updateStatusSchema,
  toggleFeaturedSchema,
  jobSearchQuerySchema,
  companyJobsQuerySchema,
};
