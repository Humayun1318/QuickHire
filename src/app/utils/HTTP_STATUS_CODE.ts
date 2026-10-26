import httpStatus from 'http-status-codes';

export const HTTP_STATUS_CODE = {
  OK: httpStatus.OK,
  CREATED: httpStatus.CREATED,
  BAD_REQUEST: httpStatus.BAD_REQUEST,
  UNAUTHORIZED: httpStatus.UNAUTHORIZED,
  FORBIDDEN: httpStatus.FORBIDDEN,
  NOT_FOUND: httpStatus.NOT_FOUND,
  CONFLICT: httpStatus.CONFLICT,
  PAYLOAD_TOO_LARGE: httpStatus.REQUEST_TOO_LONG,
  INTERNAL_SERVER_ERROR: httpStatus.INTERNAL_SERVER_ERROR,
  SERVICE_UNAVAILABLE: httpStatus.SERVICE_UNAVAILABLE,
};
