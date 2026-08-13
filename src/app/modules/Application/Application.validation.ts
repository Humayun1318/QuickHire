import { z } from 'zod';
import { ApplicationStatus } from './Application.constants';
// Regex matching a 24-character hex MongoDB ObjectId
const objectIdRegex = /^[a-f\d]{24}$/i;
// ─────────────────────────────────────────────────────────────
// Create application — seeker submits an application
// ─────────────────────────────────────────────────────────────
const createApplicationSchema = z.object({
  jobId: z.string().trim().regex(objectIdRegex, 'Invalid job ID'),
  resumeId: z.string().trim().regex(objectIdRegex, 'Invalid resume ID'),
  coverLetter: z
    .string()
    .trim()
    .min(10, 'Cover letter must be at least 10 characters')
    .max(2000, 'Cover letter cannot exceed 2000 characters'),
});
// ─────────────────────────────────────────────────────────────
// Withdraw application — seeker pulls their own application
// ─────────────────────────────────────────────────────────────
const withdrawApplicationSchema = z.object({
  status: z.literal(ApplicationStatus.WITHDRAWN),
});
// ─────────────────────────────────────────────────────────────
// Employer review — status / employer note / score
// Employer-only fields are updated through this shared schema.
// Allowed status transitions are enforced in the service layer.
// ─────────────────────────────────────────────────────────────
const employerReviewSchema = z
  .object({
    status: z.enum(Object.values(ApplicationStatus)).optional(),
    employerNote: z
      .string()
      .trim()
      .max(1000, 'Employer note cannot exceed 1000 characters')
      .optional(),
    score: z
      .number()
      .int('Score must be an integer')
      .min(0, 'Score must be at least 0')
      .max(100, 'Score cannot exceed 100')
      .optional(),
  })
  .partial();
export const applicationValidation = {
  createApplicationSchema,
  withdrawApplicationSchema,
  employerReviewSchema,
};
