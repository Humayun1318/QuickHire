import { z } from 'zod';
import { httpUrl } from '../../shared/validation/common.validation';

// ─────────────────────────────────────────────────────────────
// Create — title + an http(s) link to the resume file.
// File upload itself is out of scope: the client uploads to a storage
// provider and sends the resulting URL.
// ─────────────────────────────────────────────────────────────
const createResumeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Resume title is required')
    .max(80, 'Resume title cannot exceed 80 characters'),
  fileUrl: httpUrl('Invalid file URL'),
});

// ─────────────────────────────────────────────────────────────
// Update — rename or replace the file URL
// ─────────────────────────────────────────────────────────────
const updateResumeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Resume title is required')
    .max(80, 'Resume title cannot exceed 80 characters')
    .optional(),
  fileUrl: httpUrl('Invalid file URL').optional(),
});

export const resumeValidation = {
  createResumeSchema,
  updateResumeSchema,
};
