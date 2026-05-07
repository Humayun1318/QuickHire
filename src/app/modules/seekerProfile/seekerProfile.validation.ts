// Zod schemas validate incoming request bodies at the route boundary,
// before they reach the service layer. This keeps services clean.

import { z } from 'zod';
import {
    AvailabilityStatus,
    JobPreferenceType,
    SalaryCurrency,
} from './seekerProfile.constants';

// ─────────────────────────────────────────────────────────────
// Reusable sub-schemas
// ─────────────────────────────────────────────────────────────

const addressSchema = z.object({
    city: z.string().trim(),
    state: z.string().trim().optional(),
    country: z.string().trim(),
    postalCode: z.string().trim().optional(),
    location: z
        .object({
            type: z.literal('Point').default('Point'),
            // [longitude, latitude] — validate range for real coordinates
            coordinates: z
                .tuple([
                    z.number().min(-180).max(180), // longitude
                    z.number().min(-90).max(90),   // latitude
                ])
                .optional(),
        })
        .optional(),
});

const socialLinksSchema = z.object({
    linkedin: z.url({ error: "Invalid LinkedIn URL" }).optional(),
    github: z.url({ error: "Invalid GitHub URL" }).optional(),
    portfolio: z.url({ error: "Invalid portfolio URL" }).optional(),
    twitter: z.url({ error: "Invalid Twitter URL" }).optional(),
});

const expectedSalarySchema = z.object({
    amount: z.number().nonnegative('Salary cannot be negative'),
    currency: z.enum(SalaryCurrency).default(SalaryCurrency.BDT),
    isNegotiable: z.boolean().default(true),
});

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
    address: addressSchema.optional(),
    skills: z.array(z.string().trim()).default([]),
    languages: z.array(z.string().trim()).optional(),
    expectedSalary: expectedSalarySchema.optional(),
    jobPreference: z.enum(JobPreferenceType).optional(),
    availabilityStatus: z
        .enum(AvailabilityStatus)
        .default(AvailabilityStatus.OPEN),
    socialLinks: socialLinksSchema.optional(),
});

// ─────────────────────────────────────────────────────────────
// Update — all fields partial, no required fields
// ─────────────────────────────────────────────────────────────

const updateSeekerProfileSchema = z
    .object({
        headline: z.string().trim().max(120).optional(),
        bio: z.string().trim().max(1000).optional(),
        address: addressSchema.optional(),
        skills: z.array(z.string().trim()).optional(),
        languages: z.array(z.string().trim()).optional(),
        expectedSalary: expectedSalarySchema.optional(),
        jobPreference: z.enum(JobPreferenceType).optional(),
        availabilityStatus: z.enum(AvailabilityStatus).optional(),
        socialLinks: socialLinksSchema.optional(),
    })
    .partial()


export const seekerProfileValidation = {
    createSeekerProfileSchema,
    updateSeekerProfileSchema,
};