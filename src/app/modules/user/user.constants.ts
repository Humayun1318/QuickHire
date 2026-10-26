import { FilterConfig } from '../../shared/queryBuilder';

/**
 * QueryBuilder configuration for the admin user list (GET /users).
 * `password` is excluded by the schema (select: false) and never selectable.
 */
export const userBuilderConfig: FilterConfig = {
  searchableFields: ['name', 'email'],
  filterableFields: ['role', 'status', 'isVerified'],
  enumFields: ['role', 'status'],
  booleanFields: ['isVerified'],
  sortableFields: ['name', 'email', 'createdAt', 'lastLogin'],
  defaultSort: '-createdAt',
  defaultLimit: 20,
  maxLimit: 100,
};
