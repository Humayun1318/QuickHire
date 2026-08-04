import z from 'zod';

export const addressSchemaValidation = z
  .object({
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
            z.number().min(-90).max(90), // latitude
          ])
          .optional(),
      })
      .optional(),
  })
  .nullable();
