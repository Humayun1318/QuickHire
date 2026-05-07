
import { z } from 'zod';
import { EmploymentType, WorkMode } from './seekerExperience.constants';

const createExperienceSchema = z
    .object({
        jobTitle: z.string().trim().min(1, 'Job title is required'),
        company: z.string().trim().min(1, 'Company is required'),
        employmentType: z.enum(EmploymentType),
        workMode: z.enum(WorkMode).optional(),
        location: z.string().trim().optional(),
        startDate: z.iso.datetime({ message: 'Invalid start date' }),
        endDate: z.iso.datetime({ message: 'Invalid end date' }).optional(),
        isCurrentJob: z.boolean().default(false),
        responsibilities: z.array(z.string().trim()).default([]),
        technologiesUsed: z.array(z.string().trim()).default([]),
    })
    .refine(
        (data) => {
            if (!data.isCurrentJob && !data.endDate) return false;
            return true;
        },
        {
            message: 'End date is required when this is not your current job',
            path: ['endDate'],
        },
    )
    .refine(
        (data) => {
            if (data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
                return false;
            }
            return true;
        },
        {
            message: 'End date must be after start date',
            path: ['endDate'],
        },
    );


const updateExperienceSchema = z
    .object({
        jobTitle: z.string().trim().optional(),
        company: z.string().trim().optional(),
        employmentType: z.enum(EmploymentType).optional(),
        workMode: z.enum(WorkMode).optional(),
        location: z.string().trim().optional(),
        startDate: z.iso.datetime().optional(),
        endDate: z.iso.datetime().optional().nullable(),
        isCurrentJob: z.boolean().optional(),
        responsibilities: z.array(z.string().trim()).optional(),
        technologiesUsed: z.array(z.string().trim()).optional(),
    })
    .superRefine((data, ctx) => {
        const start = data.startDate ? new Date(data.startDate) : null;
        const end = data.endDate ? new Date(data.endDate) : null;

        // case 1: invalid date order
        if (start && end && end < start) {
            ctx.addIssue({
                code: "custom",
                path: ["endDate"],
                message: "End date must be after start date",
            });
        }

        // case 2: if not current job and endDate missing
        if (data.isCurrentJob === false && !data.endDate) {
            ctx.addIssue({
                code: "custom",
                path: ["endDate"],
                message: "End date is required when not current job",
            });
        }
    });


export const seekerExperienceValidation = {
    createExperienceSchema,
    updateExperienceSchema,
};