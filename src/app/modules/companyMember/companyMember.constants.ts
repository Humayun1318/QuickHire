

export const MEMBER_NOT_FOUND        = 'Company member not found';
export const MEMBER_ALREADY_EXISTS   = 'This user is already a member of the company';
export const CANNOT_REMOVE_OWNER     = 'The company owner cannot be removed from members';
export const CANNOT_CHANGE_OWNER_ROLE = 'The owner role cannot be changed';
export const OWNER_CANNOT_LEAVE      = 'Owner cannot leave the company. Transfer ownership or delete the company.';

// Hierarchical roles — order matters for permission checks
// OWNER > ADMIN > HR > RECRUITER > INTERVIEWER
export enum CompanyMemberRole {
  OWNER       = 'OWNER',
  ADMIN       = 'ADMIN',
  HR          = 'HR',
  RECRUITER   = 'RECRUITER',
  INTERVIEWER = 'INTERVIEWER',
}

// Permission map — defines what each role can do within the company
// Used in requireCompanyRole middleware for fine-grained access control
export const ROLE_PERMISSIONS: Record<CompanyMemberRole, string[]> = {
  [CompanyMemberRole.OWNER]: [
    'manage_members',
    'manage_company',
    'post_jobs',
    'delete_jobs',
    'view_applications',
    'manage_applications',
    'schedule_interviews',
    'view_analytics',
  ],
  [CompanyMemberRole.ADMIN]: [
    'manage_members',     // can add/remove members but not owner
    'manage_company',
    'post_jobs',
    'delete_jobs',
    'view_applications',
    'manage_applications',
    'schedule_interviews',
    'view_analytics',
  ],
  [CompanyMemberRole.HR]: [
    'post_jobs',
    'delete_jobs',
    'view_applications',
    'manage_applications',
    'schedule_interviews',
  ],
  [CompanyMemberRole.RECRUITER]: [
    'post_jobs',
    'view_applications',
    'manage_applications',
  ],
  [CompanyMemberRole.INTERVIEWER]: [
    'view_applications',
    'schedule_interviews',
  ],
};