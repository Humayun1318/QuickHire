import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';
import { sendResponse } from '../../utils/sendResponse';
import { companyMemberService } from './companyMember.service';
import { CompanyMemberRole } from './companyMember.constants';
import catchAsync from '../../utils/catchAsync';
import { getUserIdFromReq } from '../../utils/getUserIdFromReq';

// POST /companies/members
const addMember = catchAsync(async (req, res) => {
  const userId = getUserIdFromReq(req);

  const result = await companyMemberService.addMember(
    req.body.companyId,
    userId, // the person doing the adding
    req.body.userId, // the person who will be added as a member
    req.body.role as CompanyMemberRole,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Member added successfully',
    data: result,
  });
});

// GET /companies/members
const getCompanyMembers = catchAsync(async (req: Request, res: Response) => {
  const companyIdentifier = {
    companyId: req.query.companyId as string,
    slug: req.query.slug as string,
  };

  const result =
    await companyMemberService.getCompanyMembers(companyIdentifier);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Company members retrieved successfully',
    data: result,
  });
});

// PATCH /companies/members/:memberId
const updateMemberRole = catchAsync(async (req: Request, res: Response) => {
  const result = await companyMemberService.updateMemberRole(
    req.body.companyId,
    getUserIdFromReq(req),
    req.params.memberId,
    req.body.role as CompanyMemberRole,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Member role updated successfully',
    data: result,
  });
});

// DELETE /companies/members/:memberId
const removeMember = catchAsync(async (req: Request, res: Response) => {
  const result = await companyMemberService.removeMember(
    req.params.companyId,
    getUserIdFromReq(req),
    req.params.memberId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Member removed successfully',
    data: result,
  });
});

// DELETE /companies/members/leave
const leaveCompany = catchAsync(async (req: Request, res: Response) => {
  const result = await companyMemberService.leaveCompany(
    req.params.companyId,
    getUserIdFromReq(req),
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

export const companyMemberController = {
  addMember,
  getCompanyMembers,
  updateMemberRole,
  removeMember,
  leaveCompany,
};
