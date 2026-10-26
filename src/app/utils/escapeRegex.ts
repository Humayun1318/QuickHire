/**
 * Escapes RegExp metacharacters so user input can be used inside a MongoDB
 * $regex and is matched literally.
 */
export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
