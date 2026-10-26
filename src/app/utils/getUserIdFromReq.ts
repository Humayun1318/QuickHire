import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';

// req.user is set by the checkAuth middleware.

export const getUserIdFromReq = (req: Request): string => {
  return (req.user as JwtPayload).userId;
};

export const getUserRoleFromReq = (req: Request): string => {
  return (req.user as JwtPayload).role;
};
