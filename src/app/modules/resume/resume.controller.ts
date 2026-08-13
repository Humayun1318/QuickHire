import { Request, Response } from 'express';
import httpStatus from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { getUserIdFromReq } from '../../utils/getUserIdFromReq';
import { resumeService } from './resume.service';
// POST /resumes/create — seeker uploads a resume
const createResume = catchAsync(async (req: Request, res: Response) => {
  const result = await resumeService.createResume(
    getUserIdFromReq(req),
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Resume uploaded successfully',
    data: result,
  });
});
// GET /resumes — seeker's own resumes
const getMyResumes = catchAsync(async (req: Request, res: Response) => {
  const result = await resumeService.getMyResumes(getUserIdFromReq(req));
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Resumes retrieved successfully',
    data: result,
  });
});
// GET /resumes/:resumeId — seeker's single resume
const getResumeById = catchAsync(async (req: Request, res: Response) => {
  const result = await resumeService.getResumeById(
    req.params.resumeId,
    getUserIdFromReq(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Resume retrieved successfully',
    data: result,
  });
});
// PATCH /resumes/:resumeId — seeker updates own resume
const updateResume = catchAsync(async (req: Request, res: Response) => {
  const result = await resumeService.updateResume(
    req.params.resumeId,
    getUserIdFromReq(req),
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Resume updated successfully',
    data: result,
  });
});
// DELETE /resumes/:resumeId — seeker deletes own resume
const deleteResume = catchAsync(async (req: Request, res: Response) => {
  const result = await resumeService.deleteResume(
    req.params.resumeId,
    getUserIdFromReq(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null,
  });
});
// PATCH /resumes/:resumeId/set-default — seeker picks the default
const setDefaultResume = catchAsync(async (req: Request, res: Response) => {
  const result = await resumeService.setDefaultResume(
    req.params.resumeId,
    getUserIdFromReq(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Default resume updated successfully',
    data: result,
  });
});
export const resumeController = {
  createResume,
  getMyResumes,
  getResumeById,
  updateResume,
  deleteResume,
  setDefaultResume,
};
