import { z } from 'zod';
// ─────────────────────────────────────────────────────────────
// Create resume — seeker uploads a new resume
// ─────────────────────────────────────────────────────────────
const createResumeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Resume title is required')
    .max(80, 'Resume title cannot exceed 80 characters'),
  // File URL — the frontend uploads to the file-storage integration
  // and sends back the public URL
  fileUrl: z
    .string()
    .trim()
    .min(1, 'Resume file URL is required')
    .url('Invalid file URL'),
});
// ─────────────────────────────────────────────────────────────
// Update resume — title and file URL are the only editable fields
// ─────────────────────────────────────────────────────────────
const updateResumeSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Resume title is required')
      .max(80, 'Resume title cannot exceed 80 characters')
      .optional(),
    fileUrl: z.string().trim().url('Invalid file URL').optional(),
  })
  .partial();
export const resumeValidation = {
  createResumeSchema,
  updateResumeSchema,
};
