// ----------------------
// Helpers
// ----------------------

export const normalizeName = (name: string) => {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
};

export const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

export const addSuffix = (slug: string) => {
  return `${slug}-${Math.floor(Math.random() * 10000)}`;
};