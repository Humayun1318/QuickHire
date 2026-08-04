

import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';
import { sendResponse }       from '../../utils/sendResponse';
import { jobCategoryService } from './jobCategory.service';
import catchAsync from '../../utils/catchAsync';

const createCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await jobCategoryService.createCategory(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success:    true,
    message:    'Category created successfully',
    data:       result,
  });
});

const getAllCategories = catchAsync(async (_req: Request, res: Response) => {
  const result = await jobCategoryService.getAllCategories();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success:    true,
    message:    'Categories retrieved successfully',
    data:       result,
  });
});

const getCategoryTree = catchAsync(async (_req: Request, res: Response) => {
  const result = await jobCategoryService.getCategoryTree();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success:    true,
    message:    'Category tree retrieved successfully',
    data:       result,
  });
});

const getRootCategories = catchAsync(async (_req: Request, res: Response) => {
  const result = await jobCategoryService.getRootCategories();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success:    true,
    message:    'Root categories retrieved successfully',
    data:       result,
  });
});

const getChildCategories = catchAsync(async (req: Request, res: Response) => {
  const result = await jobCategoryService.getChildCategories(
    req.params.categoryId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success:    true,
    message:    'Sub-categories retrieved successfully',
    data:       result,
  });
});

const getCategoryBySlug = catchAsync(async (req: Request, res: Response) => {
  const result = await jobCategoryService.getCategoryBySlug(req.params.slug);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success:    true,
    message:    'Category retrieved successfully',
    data:       result,
  });
});

const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await jobCategoryService.updateCategory(
    req.params.categoryId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success:    true,
    message:    'Category updated successfully',
    data:       result,
  });
});

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await jobCategoryService.deleteCategory(req.params.categoryId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success:    true,
    message:    result.message,
    data:       null,
  });
});

export const jobCategoryController = {
  createCategory,
  getAllCategories,
  getCategoryTree,
  getRootCategories,
  getChildCategories,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
};