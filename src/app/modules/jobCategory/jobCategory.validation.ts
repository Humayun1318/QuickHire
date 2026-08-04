

import { z } from 'zod';

const createCategorySchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, 'Category name must be at least 2 characters')
        .max(80, 'Category name cannot exceed 80 characters'),
    icon: z.string().trim().optional(),
    // parentId is a MongoDB ObjectId string
    parentId: z
        .string()
        .regex(/^[a-f\d]{24}$/i, 'Invalid parent category ID')
        .optional()
        .nullable(),
})


const updateCategorySchema = z
    .object({
        name: z.string().trim().min(2).max(80).optional(),
        icon: z.string().trim().optional(),
        parentId: z
            .string()
            .regex(/^[a-f\d]{24}$/i, 'Invalid parent category ID')
            .optional()
            .nullable(),
        isActive: z.boolean().optional(),
    })
    .partial()


export const jobCategoryValidation = {
    createCategorySchema,
    updateCategorySchema,
};