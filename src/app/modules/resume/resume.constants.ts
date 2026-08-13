import { HTTP_STATUS_CODE } from '../../utils/HTTP_STATUS_CODE';
// ─────────────────────────────────────────────────────────────
// Error messages
// ─────────────────────────────────────────────────────────────
export const RESUME_NOT_FOUND = 'Resume not found';
export const MAX_RESUMES_PER_USER = 5;
export const MAX_RESUMES_REACHED = `You can keep at most ${MAX_RESUMES_PER_USER} resumes. Delete an existing one before adding another.`;
export const DEFAULT_RESUME_NOT_ALLOWED =
  'A deleted resume cannot be set as default';
export const LAST_RESUME_CANNOT_BE_DELETED =
  'You cannot delete your last resume — at least one resume must be kept';
// HTTP status map — matches the project's shared status helper
export const RESUME_HTTP_STATUS = {
  ok: HTTP_STATUS_CODE.OK,
  created: HTTP_STATUS_CODE.CREATED,
  badRequest: HTTP_STATUS_CODE.BAD_REQUEST,
  forbidden: HTTP_STATUS_CODE.FORBIDDEN,
  notFound: HTTP_STATUS_CODE.NOT_FOUND,
  conflict: HTTP_STATUS_CODE.CONFLICT,
};
