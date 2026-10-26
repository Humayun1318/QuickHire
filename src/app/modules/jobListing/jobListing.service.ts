import httpStatus from 'http-status-codes';
import {
  JOB_NOT_FOUND,
  JOB_NOT_OWNED,
  JOB_MANAGER_ROLES,
  JobStatus,
} from './jobListing.constants';
import {
  ICompanyJobsQuery,
  IJobListing,
  IJobListingDocument,
  IJobListingQuery,
} from './jobListing.interface';
import { JobListing } from './jobListing.models';
import { buildJobQuery, buildPagination } from './jobListing.utils';
import { Company } from '../company/company.models';
import { CompanyMember } from '../companyMember/companyMember.models';
import { JobCategory } from '../jobCategory/jobCategory.models';
import { jobCategoryService } from '../jobCategory/jobCategory.service';
import { COMPANY_NOT_FOUND } from '../company/company.constants';
import AppError from '../../errorHelpers/AppError';
import { UserRole } from '../user/user.interface';

// Public company fields shown alongside a job listing.
const PUBLIC_COMPANY_FIELDS = 'name slug logo verificationStatus';

/**
 * Throws 403 unless the user is an active OWNER/ADMIN/HR/RECRUITER of the
 * company.
 */
const assertJobManager = async (companyId: string, userId: string) => {
  const member = await CompanyMember.getMemberWithRole(companyId, userId);
  if (!member || !JOB_MANAGER_ROLES.includes(member.role)) {
    throw new AppError(httpStatus.FORBIDDEN, JOB_NOT_OWNED);
  }
};

/**
 * Loads an active job and verifies the requester may manage it. The company
 * is taken from the job document itself — never from the request body — so
 * a member of company A cannot modify company B's jobs by sending A's id.
 */
const loadManagedJob = async (
  jobId: string,
  userId: string,
): Promise<IJobListingDocument> => {
  const job = await JobListing.isJobExists(jobId);
  if (!job) {
    throw new AppError(httpStatus.NOT_FOUND, JOB_NOT_FOUND);
  }

  await assertJobManager(job.companyId.toString(), userId);
  return job;
};

const assertCategoryExists = async (categoryId: string) => {
  const category = await JobCategory.isCategoryExists(categoryId);
  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, 'Job category not found');
  }
};

// ─────────────────────────────────────────────────────────────
// Create — company OWNER / ADMIN / HR / RECRUITER
// ─────────────────────────────────────────────────────────────
const createJob = async (
  userId: string,
  companyId: string,
  payload: Partial<IJobListing>,
) => {
  const company = await Company.isCompanyExists(companyId);
  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, COMPANY_NOT_FOUND);
  }

  const member = await CompanyMember.getMemberWithRole(companyId, userId);
  if (!member || !JOB_MANAGER_ROLES.includes(member.role)) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only company OWNER, ADMIN, HR, or RECRUITER can post jobs',
    );
  }

  if (payload.categoryId) {
    await assertCategoryExists(payload.categoryId.toString());
  }

  const job = await JobListing.create({
    ...payload,
    companyId,
    postedBy: userId,
  });

  if (job.status === JobStatus.PUBLISHED && job.categoryId) {
    await jobCategoryService.incrementJobCount(job.categoryId.toString());
  }

  return job;
};

// ─────────────────────────────────────────────────────────────
// Public search — published, non-expired jobs only
// ─────────────────────────────────────────────────────────────
const searchJobs = async (queryParams: IJobListingQuery) => {
  const { filter, sort, skip, limit, page } = buildJobQuery(queryParams);

  const projection = queryParams.searchTerm
    ? { score: { $meta: 'textScore' } }
    : {};

  const [jobs, total] = await Promise.all([
    JobListing.find(filter, projection)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('companyId', PUBLIC_COMPANY_FIELDS)
      .populate('categoryId', 'name slug')
      .lean(),
    JobListing.countDocuments(filter),
  ]);

  return {
    jobs,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ─────────────────────────────────────────────────────────────
// Public detail — published jobs only (drafts/closed are visible to company
// members via GET /jobs/company/:companyId). Each view increments viewCount.
// ─────────────────────────────────────────────────────────────
const getPublishedJob = async (filter: Record<string, unknown>) => {
  const job = await JobListing.findOneAndUpdate(
    { ...filter, isActive: true, status: JobStatus.PUBLISHED },
    { $inc: { viewCount: 1 } },
    { new: true },
  )
    .populate('companyId', `${PUBLIC_COMPANY_FIELDS} description address`)
    .populate('categoryId', 'name slug')
    .populate('postedBy', 'name avatar');

  if (!job) {
    throw new AppError(httpStatus.NOT_FOUND, JOB_NOT_FOUND);
  }

  return job;
};

const getJobById = (jobId: string) => getPublishedJob({ _id: jobId });

const getJobBySlug = (slug: string) => getPublishedJob({ slug });

// ─────────────────────────────────────────────────────────────
// Company dashboard — all of a company's jobs, any status.
// Requires active membership (any role) or a platform admin.
// ─────────────────────────────────────────────────────────────
const getCompanyJobs = async (
  companyId: string,
  requester: { userId: string; role: string },
  queryParams: ICompanyJobsQuery,
) => {
  const isPlatformAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(
    requester.role as UserRole,
  );

  if (!isPlatformAdmin) {
    const member = await CompanyMember.getMemberWithRole(
      companyId,
      requester.userId,
    );
    if (!member) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You are not a member of this company',
      );
    }
  }

  const { page, limit, skip } = buildPagination(queryParams);

  const filter: Record<string, unknown> = {
    companyId,
    isActive: true,
  };
  if (queryParams.status) {
    filter.status = queryParams.status;
  }

  const [jobs, total] = await Promise.all([
    JobListing.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('categoryId', 'name slug')
      .lean(),
    JobListing.countDocuments(filter),
  ]);

  return {
    jobs,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ─────────────────────────────────────────────────────────────
// Update content fields
// ─────────────────────────────────────────────────────────────
const updateJob = async (
  jobId: string,
  userId: string,
  payload: Partial<IJobListing>,
) => {
  const job = await loadManagedJob(jobId, userId);

  const newCategoryId = payload.categoryId?.toString();
  const oldCategoryId = job.categoryId?.toString();
  const categoryChanged =
    newCategoryId !== undefined && newCategoryId !== oldCategoryId;

  if (categoryChanged) {
    await assertCategoryExists(newCategoryId);
  }

  const updated = await JobListing.findByIdAndUpdate(
    jobId,
    { $set: payload },
    { new: true, runValidators: true },
  );

  // Keep cached category job counts in sync for published jobs.
  if (categoryChanged && job.status === JobStatus.PUBLISHED) {
    if (oldCategoryId) {
      await jobCategoryService.decrementJobCount(oldCategoryId);
    }
    await jobCategoryService.incrementJobCount(newCategoryId);
  }

  return updated;
};

// ─────────────────────────────────────────────────────────────
// Status transitions (draft / published / closed / expired)
// ─────────────────────────────────────────────────────────────
const updateJobStatus = async (
  jobId: string,
  userId: string,
  newStatus: JobStatus,
) => {
  const job = await loadManagedJob(jobId, userId);
  const previousStatus = job.status;

  if (previousStatus === newStatus) {
    throw new AppError(httpStatus.BAD_REQUEST, `Job is already ${newStatus}`);
  }

  if (newStatus === JobStatus.PUBLISHED && job.expiresAt <= new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This job has passed its expiry date. Update expiresAt before publishing.',
    );
  }

  const updated = await JobListing.findByIdAndUpdate(
    jobId,
    { $set: { status: newStatus } },
    { new: true },
  );

  // Category counts track PUBLISHED jobs only: adjust whenever a job enters
  // or leaves the published state (including published -> draft).
  if (job.categoryId) {
    const catId = job.categoryId.toString();
    if (newStatus === JobStatus.PUBLISHED) {
      await jobCategoryService.incrementJobCount(catId);
    } else if (previousStatus === JobStatus.PUBLISHED) {
      await jobCategoryService.decrementJobCount(catId);
    }
  }

  return updated;
};

// ─────────────────────────────────────────────────────────────
// Soft delete
// ─────────────────────────────────────────────────────────────
const deleteJob = async (jobId: string, userId: string) => {
  const job = await loadManagedJob(jobId, userId);

  await JobListing.findByIdAndUpdate(jobId, { $set: { isActive: false } });

  if (job.status === JobStatus.PUBLISHED && job.categoryId) {
    await jobCategoryService.decrementJobCount(job.categoryId.toString());
  }

  return { message: 'Job listing deleted successfully' };
};

// ─────────────────────────────────────────────────────────────
// Admin: feature / unfeature a job
// ─────────────────────────────────────────────────────────────
const toggleFeatured = async (jobId: string, isFeatured: boolean) => {
  const job = await JobListing.findOneAndUpdate(
    { _id: jobId, isActive: true },
    { $set: { isFeatured } },
    { new: true },
  );

  if (!job) {
    throw new AppError(httpStatus.NOT_FOUND, JOB_NOT_FOUND);
  }

  return job;
};

// ─────────────────────────────────────────────────────────────
// Internal helpers used by other modules
// ─────────────────────────────────────────────────────────────

/**
 * Soft-deletes every active job of a company (used when the company itself is
 * deleted) and releases their category counts.
 */
const deactivateCompanyJobs = async (companyId: string) => {
  const publishedJobs = await JobListing.find({
    companyId,
    isActive: true,
    status: JobStatus.PUBLISHED,
    categoryId: { $ne: null },
  })
    .select('categoryId')
    .lean();

  await JobListing.updateMany(
    { companyId, isActive: true },
    { $set: { isActive: false } },
  );

  for (const job of publishedJobs) {
    await jobCategoryService.decrementJobCount(String(job.categoryId));
  }
};

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
  searchJobs,
  getJobById,
  getJobBySlug,
  getCompanyJobs,
  updateJob,
  updateJobStatus,
  deleteJob,
  toggleFeatured,
  deactivateCompanyJobs,
  incrementApplicationCount,
  decrementApplicationCount,
};
