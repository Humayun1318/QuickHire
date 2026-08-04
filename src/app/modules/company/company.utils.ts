import { Company } from './company.models';

// for name normalization
export const normalizeName = (name: string) => {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
};

// for slug generation
export const generateSlug = (name: string) => {
  return name
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

/**
 * Generate a unique slug.
 *
 * Examples:
 * google
 * google-2
 * google-3
 *
 * excludeCompanyId is used during update so the current
 * company's own slug doesn't conflict with itself.
 */
export const generateUniqueSlug = async (
  name: string,
  excludeCompanyId?: string,
) => {
  const baseSlug = generateSlug(normalizeName(name));

  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const existing = await Company.findOne({
      slug,
      ...(excludeCompanyId && {
        _id: { $ne: excludeCompanyId },
      }),
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};
