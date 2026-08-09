import { z } from 'zod';
import { queryBuilderSchema, queryNumber } from '../../shared/validation/queryBuilderSchema';

const objectIdRegex = /^[a-f\d]{24}$/i;
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
        .regex(objectIdRegex, 'Invalid parent category ID')
        .optional()
        .nullable(),
})


const updateCategorySchema = z
    .object({
        name: z.string().trim().min(2).max(80).optional(),
        icon: z.string().trim().optional(),
        parentId: z
            .string()
            .regex(objectIdRegex, 'Invalid parent category ID')
            .optional()
            .nullable(),
        isActive: z.boolean().optional(),
    })
    .partial()


export const getCategoryQuerySchema =
    queryBuilderSchema
        .extend({
            isActive: z
                .enum(['true', 'false'])
                .optional(),

            parentId: z
                .string()
                .trim()
                .regex(
                    objectIdRegex,
                    'Invalid parent category ID',
                )
                .optional(),

            depth: queryNumber.optional(),
            jobCount: queryNumber.optional(),
            minDepth: queryNumber.optional(),
            maxDepth: queryNumber.optional(),
            minJobCount: queryNumber.optional(),
            maxJobCount: queryNumber.optional(),
        })
        .strict();


export const jobCategoryValidation = {
    createCategorySchema,
    updateCategorySchema,
    getCategoryQuerySchema
};