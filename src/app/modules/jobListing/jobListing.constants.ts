

export const JOB_NOT_FOUND  = 'Job listing not found';
export const JOB_NOT_OWNED  =
  'You do not have permission to modify this job listing';
export const JOB_EXPIRED    = 'This job listing has expired';
export const JOB_NOT_ACTIVE =
  'This job listing is not accepting applications';

// ─────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────

export enum JobType {
  FULL_TIME  = 'full-time',
  PART_TIME  = 'part-time',
  FREELANCE  = 'freelance',
  INTERNSHIP = 'internship',
  CONTRACT   = 'contract',
}

export enum WorkMode {
  REMOTE = 'remote',
  ONSITE = 'onsite',
  HYBRID = 'hybrid',
}

export enum SalaryCurrency {
  BDT = 'BDT',
  USD = 'USD',
  GBP = 'GBP',
  EUR = 'EUR',
}

// Status lifecycle:
// draft → published → closed (manual)
//                  → expired (auto, when expiresAt passes)
// A published job can be reopened (set back to published) if not expired
export enum JobStatus {
  DRAFT     = 'draft',
  PUBLISHED = 'published',
  CLOSED    = 'closed',
  EXPIRED   = 'expired',
}

// Experience levels — used for filtering and matching
export enum ExperienceLevel {
  ENTRY  = 'entry',    // 0-1 years
  JUNIOR = 'junior',   // 1-3 years
  MID    = 'mid',      // 3-5 years
  SENIOR = 'senior',   // 5-8 years
  LEAD   = 'lead',     // 8+ years
}

// Default expiry in days when employer doesn't set a custom date
export const DEFAULT_JOB_EXPIRY_DAYS = 30;

// Roles that can post/manage jobs within a company
// Used in companyMember permission check in the service
export const JOB_MANAGER_ROLES = ['OWNER', 'ADMIN', 'HR', 'RECRUITER'];