import z from "zod";

export const socialLinksSchemaValidation = z.object({
    linkedin: z.url({ error: "Invalid LinkedIn URL" }).optional(),
    github: z.url({ error: "Invalid GitHub URL" }).optional(),
    portfolio: z.url({ error: "Invalid portfolio URL" }).optional(),
    twitter: z.url({ error: "Invalid Twitter URL" }).optional(),
}).nullable();