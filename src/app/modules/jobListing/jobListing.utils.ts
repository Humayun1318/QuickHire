import { SortOrder, Types } from 'mongoose';
import { JobStatus } from './jobListing.constants';
import { IJobListingQuery } from './jobListing.interface';
import { escapeRegex } from '../../utils/escapeRegex';

export const JOB_SEARCH_MAX_LIMIT = 50;

export interface IBuiltJobQuery {
  filter: Record<string, unknown>;
  sort: Record<string, SortOrder | { $meta: 'textScore' }>;
  skip: number;
  limit: number;
  page: number;
}

const toNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const buildPagination = (params: {
  page?: unknown;
  limit?: unknown;
}) => {
  const page = Math.max(1, Math.floor(toNumber(params.page) ?? 1));
  const limit = Math.min(
    JOB_SEARCH_MAX_LIMIT,
    Math.max(1, Math.floor(toNumber(params.limit) ?? 20)),
  );
  return { page, limit, skip: (page - 1) * limit };
};

/**
 * Builds the MongoDB filter/sort/pagination for the PUBLIC job search.
 * Only published, active, non-expired jobs are ever returned — a client
 * cannot ask for drafts or closed jobs of other companies.
 */
export const buildJobQuery = (params: IJobListingQuery): IBuiltJobQuery => {
  const {
    searchTerm,
    categoryId,
    type,
    workMode,
    experienceLevel,
    city,
    country,
    salaryMin,
    salaryMax,
    isFeatured,
    companyId,
    sortBy = 'newest',
  } = params;

  const filter: Record<string, unknown> = {
    isActive: true,
    status: JobStatus.PUBLISHED,
    expiresAt: { $gt: new Date() },
  };

  // Full-text search over the weighted text index (title > skills > description)
  if (searchTerm) {
    filter.$text = { $search: String(searchTerm) };
  }

  if (categoryId) filter.categoryId = new Types.ObjectId(String(categoryId));
  if (companyId) filter.companyId = new Types.ObjectId(String(companyId));
  if (type) filter.type = type;
  if (workMode) filter.workMode = workMode;
  if (experienceLevel) filter.experienceLevel = experienceLevel;

  if (isFeatured !== undefined) {
    filter.isFeatured = String(isFeatured) === 'true';
  }

  // Case-insensitive partial match; input is escaped so it is literal text.
  if (city) {
    filter['location.city'] = {
      $regex: escapeRegex(String(city)),
      $options: 'i',
    };
  }
  if (country) {
    filter['location.country'] = {
      $regex: escapeRegex(String(country)),
      $options: 'i',
    };
  }

  // Jobs whose salary range lies within the requested bounds.
  const minSalary = toNumber(salaryMin);
  const maxSalary = toNumber(salaryMax);
  if (minSalary !== undefined) {
    filter['salary.min'] = { $gte: minSalary };
  }
  if (maxSalary !== undefined) {
    filter['salary.max'] = { $lte: maxSalary };
  }

  let sort: IBuiltJobQuery['sort'];
  if (sortBy === 'relevance' && searchTerm) {
    sort = { score: { $meta: 'textScore' } };
  } else if (sortBy === 'salary') {
    sort = { 'salary.max': -1, createdAt: -1 }; // highest max salary first
  } else {
    sort = { isFeatured: -1, createdAt: -1 }; // newest, featured first
  }

  const { page, limit, skip } = buildPagination(params);

  return { filter, sort, skip, limit, page };
};
