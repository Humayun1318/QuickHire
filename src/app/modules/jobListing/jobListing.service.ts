import httpStatus from 'http-status-codes';
import {
  JOB_NOT_FOUND,
  JOB_NOT_OWNED,
  JOB_MANAGER_ROLES,
  JobStatus,
} from './jobListing.constants';
import { IJobListing, IJobListingQuery } from './jobListing.interface';
import { JobListing }       from './jobListing.models';
import { buildJobQuery }    from './jobListing.utils';
import { Company }          from '../company/company.models';
import { CompanyMember }    from '../companyMember/companyMember.models';
import { JobCategory }      from '../jobCategory/jobCategory.models';
import { jobCategoryService } from '../jobCategory/jobCategory.service';
import { COMPANY_NOT_FOUND }  from '../company/company.constants';
import AppError from '../../errorHelpers/AppError';

// ─────────────────────────────────────────────────────────────
// Create — employer member with sufficient role
// ─────────────────────────────────────────────────────────────

const createJob = async (
  userId:    string,
  companyId: string,
  payload:   Partial<IJobListing>,
) => {
  // Verify company exists and is active
  const company = await Company.isCompanyExists(companyId);
  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, COMPANY_NOT_FOUND);
  }

  // Verify the posting user is a member with a role that can post jobs
  const member = await CompanyMember.getMemberWithRole(companyId, userId);
  if (!member || !JOB_MANAGER_ROLES.includes(member.role)) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only company OWNER, ADMIN, HR, or RECRUITER can post jobs',
    );
  }

  // If categoryId provided, verify it exists
  if (payload.categoryId) {
    const category = await JobCategory.isCategoryExists(
      payload.categoryId.toString(),
    );
    if (!category) {
      throw new AppError(httpStatus.NOT_FOUND, 'Job category not found');
    }
  }

  const job = await JobListing.create({
    ...payload,
    companyId,
    postedBy: userId,
  });

  // If posting directly as published, increment category job count
  if (job.status === JobStatus.PUBLISHED && job.categoryId) {
    await jobCategoryService.incrementJobCount(job.categoryId.toString());
  }

  return job;
};

// ─────────────────────────────────────────────────────────────
// Public search — paginated, filtered, sorted
// ─────────────────────────────────────────────────────────────

// const searchJobs = async (queryParams: IJobListingQuery) => {
//   const { filter, sort, skip, limit } = buildJobQuery(queryParams);

//   // Projection: if text search, include relevance score
//   const projection = queryParams.searchTerm
//     ? { score: { $meta: 'textScore' } }
//     : {};

//   const [jobs, total] = await Promise.all([
//     JobListing.find(filter, projection)
//       .sort(sort)
//       .skip(skip)
//       .limit(limit)
//       .populate('companyId',  'name slug logo isVerified')
//       .populate('categoryId', 'name slug')
//       .lean(),
//     JobListing.countDocuments(filter),
//   ]);

//   return {
//     jobs,
//     meta: {
//       total,
//       page:       Math.floor(skip / limit) + 1,
//       limit,
//       totalPages: Math.ceil(total / limit),
//     },
//   };
// };

// ─────────────────────────────────────────────────────────────
// Get single job by ID — increment view count
// ─────────────────────────────────────────────────────────────

const getJobById = async (jobId: string) => {
  // $inc viewCount atomically — no separate update query needed
  const job = await JobListing.findOneAndUpdate(
    { _id: jobId, isActive: true },
    { $inc: { viewCount: 1 } },
    { new: true },
  )
    .populate('companyId',  'name slug logo description address isVerified')
    .populate('categoryId', 'name slug')
    .populate('postedBy',   'name avatar');

  if (!job) {
    throw new AppError(httpStatus.NOT_FOUND, JOB_NOT_FOUND);
  }

  return job;
};

// Get by slug — used for SEO-friendly job detail pages
const getJobBySlug = async (slug: string) => {
  const job = await JobListing.findOneAndUpdate(
    { slug, isActive: true, status: JobStatus.PUBLISHED },
    { $inc: { viewCount: 1 } },
    { new: true },
  )
    .populate('companyId',  'name slug logo description isVerified')
    .populate('categoryId', 'name slug');

  if (!job) {
    throw new AppError(httpStatus.NOT_FOUND, JOB_NOT_FOUND);
  }

  return job;
};

// ─────────────────────────────────────────────────────────────
// Company's own job listings — employer dashboard
// ─────────────────────────────────────────────────────────────

const getCompanyJobs = async (
  companyId: string,
  queryParams: IJobListingQuery,
) => {
  // Override filter to show company's own jobs (all statuses, not just published)
  const { sort, skip, limit } = buildJobQuery(queryParams);

  const filter: Record<string, unknown> = {
    companyId,
    isActive: true,
  };

  // Allow filtering by status from employer dashboard
  if (queryParams.status) {
    filter.status = queryParams.status;
  }

  // const [jobs, total] = await Promise.all([
  //   JobListing.find(filter)
  //     .sort(sort)
  //     .skip(skip)
  //     .limit(limit)
  //     .populate('categoryId', 'name slug')
  //     .lean(),
  //   JobListing.countDocuments(filter),
  // ]);

  // return {
  //   jobs,
  //   meta: {
  //     total,
  //     page:       Math.floor(skip / limit) + 1,
  //     limit,
  //     totalPages: Math.ceil(total / limit),
  //   },
  // };
};

// ─────────────────────────────────────────────────────────────
// Update job content
// ─────────────────────────────────────────────────────────────

const updateJob = async (
  jobId:     string,
  userId:    string,
  companyId: string,
  payload:   Partial<IJobListing>,
) => {
  // Verify ownership at company level
  const job = await JobListing.isOwnedByCompany(jobId, companyId);
  if (!job) {
    throw new AppError(httpStatus.FORBIDDEN, JOB_NOT_OWNED);
  }

  // Verify member has role to manage jobs
  const member = await CompanyMember.getMemberWithRole(companyId, userId);
  if (!member || !JOB_MANAGER_ROLES.includes(member.role)) {
    throw new AppError(httpStatus.FORBIDDEN, JOB_NOT_OWNED);
  }

  const updated = await JobListing.findByIdAndUpdate(
    jobId,
    { $set: payload },
    { new: true, runValidators: true },
  );

  return updated;
};

// ─────────────────────────────────────────────────────────────
// Update status — handles category jobCount side effects
// draft → published: increment jobCount
// published → closed/expired: decrement jobCount
// ─────────────────────────────────────────────────────────────

const updateJobStatus = async (
  jobId:     string,
  userId:    string,
  companyId: string,
  newStatus: JobStatus,
) => {
  const job = await JobListing.isOwnedByCompany(jobId, companyId);
  if (!job) {
    throw new AppError(httpStatus.FORBIDDEN, JOB_NOT_OWNED);
  }

  const member = await CompanyMember.getMemberWithRole(companyId, userId);
  if (!member || !JOB_MANAGER_ROLES.includes(member.role)) {
    throw new AppError(httpStatus.FORBIDDEN, JOB_NOT_OWNED);
  }

  const previousStatus = job.status;

  const updated = await JobListing.findByIdAndUpdate(
    jobId,
    { $set: { status: newStatus } },
    { new: true },
  );

  // Side effect: maintain category jobCount cache
  if (job.categoryId) {
    const catId = job.categoryId.toString();

    // Going live → increment
    if (
      previousStatus !== JobStatus.PUBLISHED &&
      newStatus === JobStatus.PUBLISHED
    ) {
      await jobCategoryService.incrementJobCount(catId);
    }

    // Going offline → decrement
    if (
      previousStatus === JobStatus.PUBLISHED &&
      (newStatus === JobStatus.CLOSED || newStatus === JobStatus.EXPIRED)
    ) {
      await jobCategoryService.decrementJobCount(catId);
    }
  }

  return updated;
};

// ─────────────────────────────────────────────────────────────
// Soft delete
// ─────────────────────────────────────────────────────────────

const deleteJob = async (
  jobId:     string,
  userId:    string,
  companyId: string,
) => {
  const job = await JobListing.isOwnedByCompany(jobId, companyId);
  if (!job) {
    throw new AppError(httpStatus.FORBIDDEN, JOB_NOT_OWNED);
  }

  const member = await CompanyMember.getMemberWithRole(companyId, userId);
  if (!member || !JOB_MANAGER_ROLES.includes(member.role)) {
    throw new AppError(httpStatus.FORBIDDEN, JOB_NOT_OWNED);
  }

  await JobListing.findByIdAndUpdate(jobId, { $set: { isActive: false } });

  // If job was published, decrement category count on delete
  if (job.status === JobStatus.PUBLISHED && job.categoryId) {
    await jobCategoryService.decrementJobCount(job.categoryId.toString());
  }

  return { message: 'Job listing deleted successfully' };
};

// ─────────────────────────────────────────────────────────────
// Admin — toggle featured status
// ─────────────────────────────────────────────────────────────

const toggleFeatured = async (jobId: string, isFeatured: boolean) => {
  const job = await JobListing.findByIdAndUpdate(
    jobId,
    { $set: { isFeatured } },
    { new: true },
  );

  if (!job) {
    throw new AppError(httpStatus.NOT_FOUND, JOB_NOT_FOUND);
  }

  return job;
};

// ─────────────────────────────────────────────────────────────
// Internal — called by application service on apply/withdraw
// ─────────────────────────────────────────────────────────────

const incrementApplicationCount = async (jobId: string) => {
  await JobListing.findByIdAndUpdate(jobId, {
    $inc: { applicationCount: 1 },
  });
};

const decrementApplicationCount = async (jobId: string) => {
  await JobListing.findOneAndUpdate(
    { _id: jobId, applicationCount: { $gt: 0 } },
    { $inc: { applicationCount: -1 } },
  );
};

export const jobListingService = {
  createJob,
  // searchJobs,
  getJobById,
  getJobBySlug,
  getCompanyJobs,
  updateJob,
  updateJobStatus,
  deleteJob,
  toggleFeatured,
  incrementApplicationCount,
  decrementApplicationCount,
};