import { z } from 'zod';
import { DegreeType } from './seekerEducation.constants';

const createEducationSchema = z
    .object({
        institution: z.string().trim().min(1, 'Institution is required'),
        degree: z.enum(DegreeType),
        fieldOfStudy: z.string().trim().optional(),
        startDate: z.iso.datetime({ message: 'Invalid start date' }),
        endDate: z.iso.datetime({ message: 'Invalid end date' }).optional(),
        grade: z.string().trim().optional(),
        description: z.string().trim().max(500).optional(),
        isCurrentlyStudying: z.boolean().default(false),
    })
    .refine(
        (data) => {
            // If not currently studying, endDate must exist
            if (!data.isCurrentlyStudying && !data.endDate) return false;
            return true;
        },
        {
            message: 'End date is required when not currently studying',
            path: ['endDate'],
        },
    )
    .refine(
        (data) => {
            // endDate must be after startDate
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


const updateEducationSchema = z
    .object({
        institution: z.string().trim().optional(),
        degree: z.enum(DegreeType).optional(),
        fieldOfStudy: z.string().trim().optional(),
        startDate: z.iso.datetime().optional(),
        endDate: z.iso.datetime().optional().nullable(),
        grade: z.string().trim().optional(),
        description: z.string().trim().max(500).optional(),
        isCurrentlyStudying: z.boolean().optional(),
    })
    .superRefine((data, ctx) => {
        const start = data.startDate ? new Date(data.startDate) : null;
        const end = data.endDate ? new Date(data.endDate) : null;

        // ❌ rule 1: endDate must be after startDate
        if (start && end && end < start) {
            ctx.addIssue({
                code: "custom",
                path: ["endDate"],
                message: "End date must be after start date",
            });
        }

        // ❌ rule 2: if not currently studying → endDate required
        if (data.isCurrentlyStudying === false && !data.endDate) {
            ctx.addIssue({
                code: "custom",
                path: ["endDate"],
                message: "End date is required when not currently studying",
            });
        }
    });


export const seekerEducationValidation = {
    createEducationSchema,
    updateEducationSchema,
};