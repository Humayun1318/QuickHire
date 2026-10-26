import z from 'zod';
import { httpUrl } from './common.validation';

export const socialLinksSchemaValidation = z
  .object({
    linkedin: httpUrl('Invalid LinkedIn URL').optional(),
    github: httpUrl('Invalid GitHub URL').optional(),
    portfolio: httpUrl('Invalid portfolio URL').optional(),
    twitter: httpUrl('Invalid Twitter URL').optional(),
  })
  .nullable();
