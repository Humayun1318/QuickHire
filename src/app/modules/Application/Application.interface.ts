import { Document, Model, Types } from 'mongoose';
import { ApplicationStatus } from './Application.constants';
// ─────────────────────────────────────────────────────────────
// Core interface —
//
//   User        1:N Application   (applicantId)
//   Resume      1:N Application   (resumeId)
//   JobListing  1:N Application   (jobId)
// ─────────────────────────────────────────────────────────────
export interface IApplication {
  // FK → jobListings — the job being applied to
  jobId: Types.ObjectId;
  // FK → users — the applicant (must be a SEEKER)
  applicantId: Types.ObjectId;
  // FK → resumes — the resume attached at application time.
  // The resume must belong to the applicant.
  resumeId: Types.ObjectId;
  coverLetter: string;
  status: ApplicationStatus;
  // Employer-side fields — only editable by the employer who owns
  // the company the job belongs to (or ADMIN/SUPER_ADMIN)
  employerNote?: string;
  // Integer score from 0 to 100
  score?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IApplicationDocument extends IApplication, Document {}
export interface IApplicationModel extends Model<IApplicationDocument> {
  // Find an application only if it belongs to this applicant —
  // used for seeker-side update/delete protection
  isOwnedByApplicant(
    applicationId: string,
    applicantId: string,
  ): Promise<IApplicationDocument | null>;
  // Check whether this applicant already applied to this job —
  // enforces the one-application-per-seeker-per-job rule
  isAlreadyApplied(jobId: string, applicantId: string): Promise<boolean>;
}

export interface CreateApplicationDTO {
  jobId: string;
  resumeId: string;
  coverLetter: string;
}
export interface UpdateEmployerFieldsDTO {
  status?: ApplicationStatus;
  employerNote?: string;
  score?: number;
}
