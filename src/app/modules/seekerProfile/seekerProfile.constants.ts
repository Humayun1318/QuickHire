
// Centralizing all enums and constants prevents magic strings scattered
// across the codebase and makes refactoring safer.

export const SEEKER_PROFILE_NOT_FOUND = 'Seeker profile not found';
export const SEEKER_PROFILE_ALREADY_EXISTS =
  'Seeker profile already exists for this user';
export const PROFILE_COMPLETENESS_THRESHOLD = 80; // % above which profile is "complete"

// Job preference types a seeker can select
export enum JobPreferenceType {
  REMOTE = 'remote',
  HYBRID = 'hybrid',
  ONSITE = 'onsite',
}

// Availability status — shown to employers on search
export enum AvailabilityStatus {
  OPEN = 'open',               // actively looking
  PASSIVE = 'passive',         // open to offers but not actively searching
  NOT_LOOKING = 'not_looking', // employed and not interested
}

// Salary currency options — expandable for multi-currency support
export enum SalaryCurrency {
  BDT = 'BDT',
  USD = 'USD',
  GBP = 'GBP',
  EUR = 'EUR',
}

// Fields used for profile completeness scoring
// Each key maps to a weight (total = 100)
export const PROFILE_COMPLETENESS_WEIGHTS: Record<string, number> = {
  headline: 10,
  bio: 10,
  address: 10,
  skills: 15,
  expectedSalary: 5,
  jobPreference: 5,
  availabilityStatus: 5,
  socialLinks: 10,
  experiences: 15,
  educations: 15,
};