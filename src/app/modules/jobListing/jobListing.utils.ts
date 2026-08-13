// Query builder for job search — builds MongoDB filter + sort objects
// from incoming URL query params.
// Kept in utils (not service) because it is pure transformation logic
// with no DB calls or business rules.
import { Types } from 'mongoose';
import { JobStatus } from './jobListing.constants';
import { IJobListingQuery } from './jobListing.interface';

export interface IBuiltJobQuery {
  filter: Record<string, unknown>;
  sort: Record<string, unknown>;
  skip: number;
  limit: number;
}

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
    status,
    page = 1,
    limit = 20,
    sortBy = 'newest',
  } = params;

  const filter: Record<string, unknown> = {
    isActive: true,
  };

  // Default to published + not expired for public queries
  // Service can override status for employer/admin queries
  if (status) {
    filter.status = status;
  } else {
    filter.status = JobStatus.PUBLISHED;
    filter.expiresAt = { $gt: new Date() }; // not yet expired
  }

  // Full-text search — uses the compound text index (title + description + skills)
  // $text with $search enables relevance scoring via { score: { $meta: 'textScore' } }
  if (searchTerm) {
    filter.$text = { $search: searchTerm };
  }

  if (categoryId) {
    filter.categoryId = new Types.ObjectId(categoryId);
  }

  if (type) filter.type = type;
  if (workMode) filter.workMode = workMode;
  if (experienceLevel) filter.experienceLevel = experienceLevel;
  if (isFeatured !== undefined) filter.isFeatured = isFeatured;
  if (companyId) filter.companyId = new Types.ObjectId(companyId);

  // Location — case-insensitive regex for partial match
  // e.g. "dha" matches "Dhaka"
  if (city) {
    filter['location.city'] = { $regex: city, $options: 'i' };
  }
  if (country) {
    filter['location.country'] = { $regex: country, $options: 'i' };
  }

  // Salary range filter — each bound filters its own field.
  // The previous version applied both bounds to 'salary.min', which
  // accepted jobs whose max salary exceeded salaryMax. Fixed by
  // keeping the bounds strictly separated:
  //   salaryMin → salary.min must be at least this
  //   salaryMax → salary.max must be at most this
  if (salaryMin !== undefined) {
    filter['salary.min'] = { $gte: salaryMin };
  }
  if (salaryMax !== undefined) {
    filter['salary.max'] = { $lte: salaryMax };
  }

  // ── Sort ──────────────────────────────────────────────────
  let sort: Record<string, unknown> = {};

  if (sortBy === 'relevance' && searchTerm) {
    // Sort by text relevance score when doing keyword search
    // { score: { $meta: 'textScore' } } requires the $text filter
    sort = { score: { $meta: 'textScore' } };
  } else if (sortBy === 'salary') {
    sort = { 'salary.max': -1 }; // highest max salary first
  } else {
    // Default: newest first, featured jobs float to top
    sort = { isFeatured: -1, createdAt: -1 };
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(50, Math.max(1, Number(limit))); // cap at 50

  return {
    filter,
    sort,
    skip: (pageNum - 1) * limitNum,
    limit: limitNum,
  };
};
