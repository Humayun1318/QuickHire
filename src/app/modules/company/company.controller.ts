
import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';
import { sendResponse } from '../../utils/sendResponse';
import { companyService } from './company.service';
import { CompanyVerificationStatus } from './company.constants';
import catchAsync from '../../utils/catchAsync';
import { getUserIdFromReq } from '../../utils/getUserIdFromReq';

// POST /companies
const createCompany = catchAsync(async (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req)
  const result = await companyService.createCompany(userId, req.body);


  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Company created successfully',
    data: result,
  });
});

// GET /companies/me
const getMyCompany = catchAsync(async (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const result = await companyService.getMyCompany(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Company retrieved successfully',
    data: result,
  });
});

// GET /companies/:companyId
const getCompanyById = catchAsync(async (req: Request, res: Response) => {
  const result = await companyService.getCompanyById(req.params.companyId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Company retrieved successfully',
    data: result,
  });
});

// GET /companies/slug/:slug
const getCompanyBySlug = catchAsync(async (req: Request, res: Response) => {
  const result = await companyService.getCompanyBySlug(req.params.slug);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Company retrieved successfully',
    data: result,
  });
});

// PATCH /companies/:companyId
const updateCompany = catchAsync(async (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const result = await companyService.updateCompany(
    req.params.companyId,
    userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Company updated successfully',
    data: result,
  });
});

// DELETE /companies/:companyId
const deleteCompany = catchAsync(async (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const result = await companyService.deleteCompany(
    req.params.companyId,
    userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Company deleted successfully',
    data: result,
  });
});

// PATCH /companies/:companyId/verification  (admin only)
const updateVerificationStatus = catchAsync(
  async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const result = await companyService.updateVerificationStatus(
      req.params.companyId,
      req.body.verificationStatus as CompanyVerificationStatus,
      req.body.verificationNote,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Verification status updated successfully',
      data: result,
    });
  },
);

export const companyController = {
  createCompany,
  getMyCompany,
  getCompanyById,
  getCompanyBySlug,
  updateCompany,
  deleteCompany,
  updateVerificationStatus,
};