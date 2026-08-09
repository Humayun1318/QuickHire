import z from "zod";
import { FIELDS_QUERY_KEY, LIMIT_QUERY_KEY, PAGE_QUERY_KEY, SEARCH_QUERY_KEY, SORT_QUERY_KEY } from "../queryBuilder";

export const queryNumber = z
    .string()
    .trim()
    .refine(
        value =>
            value !== '' &&
            Number.isFinite(Number(value)),
        'Must be a valid number',
    );

export const queryBuilderSchema = z
    .object({
        [SEARCH_QUERY_KEY]: z
            .string()
            .trim()
            .optional(),

        [SORT_QUERY_KEY]: z
            .string()
            .trim()
            .optional(),

        [FIELDS_QUERY_KEY]: z
            .string()
            .trim()
            .optional(),

        [PAGE_QUERY_KEY]: queryNumber
            .refine(
                value => Number(value) > 0,
                'Page must be greater than 0',
            )
            .optional(),

        [LIMIT_QUERY_KEY]: queryNumber
            .refine(
                value => Number(value) > 0,
                'Limit must be greater than 0',
            )
            .optional(),
    });
