
// Job category is an admin-managed taxonomy.
// Employers select from existing categories when posting jobs.
// Seekers filter by category when searching.

export const CATEGORY_NOT_FOUND     = 'Job category not found';
export const CATEGORY_ALREADY_EXISTS = 'A category with this name already exists';
export const CATEGORY_HAS_CHILDREN  =
  'Cannot delete a category that has sub-categories. Delete sub-categories first.';
export const CATEGORY_HAS_JOBS      =
  'Cannot delete a category that has active job listings';

// Maximum depth of category nesting allowed
// Technology > Frontend > React is depth 3 — sufficient for most use cases
// Deeper nesting complicates breadcrumb rendering and tree queries
export const MAX_CATEGORY_DEPTH = 2;