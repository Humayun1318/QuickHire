import z from 'zod';

/**
 * http(s) URL only. Plain z.url() also accepts schemes such as
 * "javascript:" or "data:", which become stored XSS if a frontend renders the
 * value as a link or image source.
 */
export const httpUrl = (message = 'Must be a valid http(s) URL') =>
  z.url({ protocol: /^https?$/, error: message }).max(2048, 'URL is too long');

export const objectIdString = (message = 'Invalid ID') =>
  z
    .string()
    .trim()
    .regex(/^[a-f\d]{24}$/i, message);
