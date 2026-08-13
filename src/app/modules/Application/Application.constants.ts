// ─────────────────────────────────────────────────────────────
// Error messages
// ─────────────────────────────────────────────────────────────
export const APPLICATION_NOT_FOUND = 'Application not found';
export const ONLY_SEEKER_CAN_APPLY =
  'Only users with the SEEKER role can apply for jobs';
export const RESUME_NOT_OWNED =
  'The resume must belong to you in order to apply';
export const RESUME_NOT_FOUND = 'Resume not found';
export const JOB_NOT_FOUND_FOR_APPLICATION = 'Job listing not found';
export const JOB_NOT_ACCEPTING_APPLICATIONS =
  'This job listing is not accepting applications';
export const DUPLICATE_APPLICATION =
  'You have already applied for this job listing';
export const EMPLOYER_NOTE_NOT_ALLOWED =
  'Only the employer managing this job can update employer notes and scores';
// ─────────────────────────────────────────────────────────────
// Application lifecycle
// PENDING → SHORTLISTED → INTERVIEWED → ACCEPTED / REJECTED
// Seeker can withdraw at any stage before a decision.
// ─────────────────────────────────────────────────────────────
export enum ApplicationStatus {
  PENDING = 'pending',
  SHORTLISTED = 'shortlisted',
  INTERVIEWED = 'interviewed',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
}
// Terminal statuses — after these the application is closed
export const APPLICATION_TERMINAL_STATUSES = [
  ApplicationStatus.ACCEPTED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.WITHDRAWN,
];
// Statuses the SEEKER may transition into by themselves
