import httpStatus from 'http-status-codes';
import { MongooseError } from 'mongoose';
import { Types } from 'mongoose';
import { Application } from './Application.models';
import {
  CreateApplicationDTO,
  IApplicationDocument,
  UpdateEmployerFieldsDTO,
} from './Application.interface';
import {
  APPLICATION_NOT_FOUND,
  APPLICATION_TERMINAL_STATUSES,
  ApplicationStatus,
  DUPLICATE_APPLICATION,
  EMPLOYER_NOTE_NOT_ALLOWED,
  JOB_NOT_ACCEPTING_APPLICATIONS,
  JOB_NOT_FOUND_FOR_APPLICATION,
  ONLY_SEEKER_CAN_APPLY,
  RESUME_NOT_OWNED,
} from './Application.constants';
import AppError from '../../errorHelpers/AppError';
import { JobListing } from '../jobListing/jobListing.models';
import {
  JOB_MANAGER_ROLES,
  JobStatus,
} from '../jobListing/jobListing.constants';
import { jobListingService } from '../jobListing/jobListing.service';
import { Resume } from '../resume/resume.models';
import { User } from '../user/user.models';
import { UserRole } from '../user/user.interface';
import { CompanyMember } from '../companyMember/companyMember.models';
// ─────────────────────────────────────────────────────────────
// Submit application — the full validation flow from the spec:
//
//   Authenticated user
//     → Is the user a SEEKER?
//     → Does the resume belong to the user?
//     → Does the job listing exist and accept applications?
//     → Has the user not already applied to this job?
//     → Create the application
//
// Duplicate protection lives in both the service layer and a
// unique schema index (applicantId + jobId).
// ─────────────────────────────────────────────────────────────
const submitApplication = async (
  userId: string,
  dto: CreateApplicationDTO,
): Promise<IApplicationDocument> => {
  // 1. Applicant must be a SEEKER
  const applicant = await User.findById(userId).select('role');
  if (!applicant) {
    throw new AppError(httpStatus.NOT_FOUND, 'Applicant not found');
  }
  if (applicant.role !== UserRole.SEEKER) {
    throw new AppError(httpStatus.FORBIDDEN, ONLY_SEEKER_CAN_APPLY);
  }
  // 2. The attached resume must belong to the applicant and be active
  const resume = await Resume.isOwnedByUser(dto.resumeId, userId);
  if (!resume) {
    throw new AppError(httpStatus.FORBIDDEN, RESUME_NOT_OWNED);
  }
  // 3. The job must exist and still accept applications
  const job = await JobListing.findOne({
    _id: dto.jobId,
    isActive: true,
  }).lean();
  if (!job) {
    throw new AppError(httpStatus.NOT_FOUND, JOB_NOT_FOUND_FOR_APPLICATION);
  }
  const isPublishedAndOpen =
    job.status === JobStatus.PUBLISHED && job.expiresAt > new Date();
  if (!isPublishedAndOpen) {
    throw new AppError(httpStatus.BAD_REQUEST, JOB_NOT_ACCEPTING_APPLICATIONS);
  }
  // 4. One application per seeker per job — duplicate rejection
  const alreadyApplied = await Application.isAlreadyApplied(dto.jobId, userId);
  if (alreadyApplied) {
    throw new AppError(httpStatus.CONFLICT, DUPLICATE_APPLICATION);
  }
  // 5. Create the application — a unique index on (applicantId, jobId)
  // also rejects duplicates at the database level (see error mapping)
  let application: IApplicationDocument;
  try {
    application = await Application.create({
      jobId: new Types.ObjectId(dto.jobId),
      applicantId: new Types.ObjectId(userId),
      resumeId: new Types.ObjectId(dto.resumeId),
      coverLetter: dto.coverLetter,
      status: ApplicationStatus.PENDING,
    });
  } catch (error) {
    if (
      error instanceof MongooseError &&
      (error.message.includes('E11000') ||
        error.message.includes('duplicate key'))
    ) {
      throw new AppError(httpStatus.CONFLICT, DUPLICATE_APPLICATION);
    }
    throw error;
  }
  // 6. Maintain the cached applicationCount on the job listing
  await jobListingService.incrementApplicationCount(dto.jobId);
  return application;
};
// ─────────────────────────────────────────────────────────────
// Seeker — list own applications with job + resume populated
// ─────────────────────────────────────────────────────────────
const getMyApplications = async (
  userId: string,
): Promise<IApplicationDocument[]> => {
  return Application.find({ applicantId: userId })
    .populate('jobId', 'title slug status')
    .populate('resumeId', 'title fileUrl')
    .sort({ createdAt: -1 })
    .lean();
};
// ─────────────────────────────────────────────────────────────
// Seeker — withdraw own application
// Only allowed while the application is not in a terminal state.
// ─────────────────────────────────────────────────────────────
const withdrawApplication = async (
  applicationId: string,
  userId: string,
): Promise<IApplicationDocument> => {
  const application = await Application.isOwnedByApplicant(
    applicationId,
    userId,
  );
  if (!application) {
    throw new AppError(httpStatus.NOT_FOUND, APPLICATION_NOT_FOUND);
  }
  if (
    APPLICATION_TERMINAL_STATUSES.includes(
      application.status as ApplicationStatus,
    )
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot modify an application in '${application.status}' status`,
    );
  }
  const updated = await Application.findByIdAndUpdate(
    applicationId,
    { $set: { status: ApplicationStatus.WITHDRAWN } },
    { new: true },
  );
  // Reflect the withdrawal on the job's cached counter
  await jobListingService.decrementApplicationCount(
    application.jobId.toString(),
  );
  return updated!;
};
// ─────────────────────────────────────────────────────────────
// Employer — review: status / employerNote / score
// Authorization: the caller must be a company member with a
// job-manager role (OWNER/ADMIN/HR/RECRUITER) in the company
// that owns the job listing.
// ─────────────────────────────────────────────────────────────
const updateEmployerFields = async (
  applicationId: string,
  userId: string,
  dto: UpdateEmployerFieldsDTO,
): Promise<IApplicationDocument> => {
  const application = await Application.findById(applicationId).lean();
  if (!application) {
    throw new AppError(httpStatus.NOT_FOUND, APPLICATION_NOT_FOUND);
  }
  // The job must belong to a company the caller manages
  const job = await JobListing.findById(application.jobId)
    .select('companyId')
    .lean();
  if (!job) {
    throw new AppError(httpStatus.NOT_FOUND, JOB_NOT_FOUND_FOR_APPLICATION);
  }
  const member = await CompanyMember.getMemberWithRole(
    job.companyId.toString(),
    userId,
  );
  if (!member || !JOB_MANAGER_ROLES.includes(member.role)) {
    throw new AppError(httpStatus.FORBIDDEN, EMPLOYER_NOTE_NOT_ALLOWED);
  }
  // Employer-side fields live in their own update path —
  // seeker-provided fields can never leak through here
  const allowed: UpdateEmployerFieldsDTO = {};
  if (dto.status !== undefined) {
    const from = application.status as ApplicationStatus;
    // Closed applications cannot be reopened by the employer
    if (APPLICATION_TERMINAL_STATUSES.includes(from)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Cannot change status of an application in '${from}' status`,
      );
    }
    allowed.status = dto.status;
  }
  if (dto.employerNote !== undefined) allowed.employerNote = dto.employerNote;
  if (dto.score !== undefined) allowed.score = dto.score;
  const updated = await Application.findByIdAndUpdate(
    applicationId,
    { $set: allowed },
    { new: true, runValidators: true },
  );
  return updated!;
};
// ─────────────────────────────────────────────────────────────
// Employer — list applications for one of their job listings.
// Resolves the caller's company from the job's companyId and
// verifies the caller manages that company.
// ─────────────────────────────────────────────────────────────
const getJobApplications = async (
  jobId: string,
  userId: string,
): Promise<IApplicationDocument[]> => {
  const job = await JobListing.findById(jobId).select('companyId').lean();
  if (!job) {
    throw new AppError(httpStatus.NOT_FOUND, JOB_NOT_FOUND_FOR_APPLICATION);
  }
  const member = await CompanyMember.getMemberWithRole(
    job.companyId.toString(),
    userId,
  );
  if (!member || !JOB_MANAGER_ROLES.includes(member.role)) {
    throw new AppError(httpStatus.FORBIDDEN, EMPLOYER_NOTE_NOT_ALLOWED);
  }
  return Application.find({ jobId })
    .populate('applicantId', 'name email avatar')
    .populate('resumeId', 'title fileUrl downloadCount')
    .sort({ createdAt: -1 })
    .lean();
};
// ─────────────────────────────────────────────────────────────
// Admin — get a single application by id (audit / support)
// ─────────────────────────────────────────────────────────────
const getApplicationById = async (
  applicationId: string,
): Promise<IApplicationDocument | null> => {
  const application = await Application.findById(applicationId)
    .populate('jobId', 'title slug status')
    .populate('applicantId', 'name email role')
    .populate('resumeId', 'title fileUrl')
    .lean();
  if (!application) {
    throw new AppError(httpStatus.NOT_FOUND, APPLICATION_NOT_FOUND);
  }
  return application;
};
export const applicationService = {
  submitApplication,
  getMyApplications,
  withdrawApplication,
  updateEmployerFields,
  getJobApplications,
  getApplicationById,
};
