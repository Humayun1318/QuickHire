
import {
  CATEGORY_ALREADY_EXISTS,
  CATEGORY_HAS_CHILDREN,
  CATEGORY_NOT_FOUND,
  MAX_CATEGORY_DEPTH,
} from './jobCategory.constants';
import { IJobCategory } from './jobCategory.interface';
import { JobCategory } from './jobCategory.models';
import {
  buildBreadcrumb,
  buildCategoryTree,
} from './jobCategory.utils';
import AppError from '../../errorHelpers/AppError';
import { HTTP_STATUS_CODE } from '../../utils/HTTP_STATUS_CODE';

// ─────────────────────────────────────────────────────────────
// Create — admin only
// ─────────────────────────────────────────────────────────────

const createCategory = async (payload: Partial<IJobCategory>) => {
  // Prevent duplicate names (case-insensitive)
  const nameTaken = await JobCategory.isCategoryNameTaken(payload.name!);
  if (nameTaken) {
    throw new AppError(HTTP_STATUS_CODE.CONFLICT, CATEGORY_ALREADY_EXISTS);
  }

  // Validate parentId exists and enforce max depth
  if (payload.parentId) {
    const parent = await JobCategory.isCategoryExists(
      payload.parentId.toString(),
    );
    if (!parent) {
      throw new AppError(HTTP_STATUS_CODE.NOT_FOUND, 'Parent category not found');
    }


    // Depth check: walk up from parent to root, count levels
    // If parent is already at depth MAX-1, this child would exceed MAX
    const breadcrumb = await buildBreadcrumb(payload.parentId.toString());
    if (breadcrumb.length >= MAX_CATEGORY_DEPTH) {
      throw new AppError(
        HTTP_STATUS_CODE.BAD_REQUEST,
        `Category nesting cannot exceed ${MAX_CATEGORY_DEPTH} levels`,
      );
    }
  }

  return JobCategory.create(payload);
};

// ─────────────────────────────────────────────────────────────
// Get all as flat list — admin panel
// ─────────────────────────────────────────────────────────────

const getAllCategories = async () => {
  return JobCategory.find({ isActive: true })
    .populate('parentId', 'name slug') // show parent name for context
    .sort({ name: 1 });
};

// ─────────────────────────────────────────────────────────────
// Get full tree — homepage menu, job filter sidebar
// Single DB call + in-memory tree construction
// ─────────────────────────────────────────────────────────────

const getCategoryTree = async () => {
  const all = await JobCategory.find({ isActive: true }).lean();
  // lean() returns plain objects — buildCategoryTree handles both
  return buildCategoryTree(all as any);
};

// ─────────────────────────────────────────────────────────────
// Get root categories only — simpler homepage display
// ─────────────────────────────────────────────────────────────

const getRootCategories = async () => {
  return JobCategory.find({ parentId: null, isActive: true })
    .sort({ jobCount: -1 }); // most popular first
};

// ─────────────────────────────────────────────────────────────
// Get children of a category — dropdown submenu on hover
// ─────────────────────────────────────────────────────────────

const getChildCategories = async (parentId: string) => {
  const parent = await JobCategory.isCategoryExists(parentId);
  if (!parent) {
    throw new AppError(HTTP_STATUS_CODE.NOT_FOUND, CATEGORY_NOT_FOUND);
  }

  return JobCategory.find({ parentId, isActive: true })
    .sort({ jobCount: -1 });
};

// ─────────────────────────────────────────────────────────────
// Get single category with breadcrumb
// ─────────────────────────────────────────────────────────────

const getCategoryBySlug = async (slug: string) => {
  const category = await JobCategory.findOne({ slug, isActive: true });
  if (!category) {
    throw new AppError(HTTP_STATUS_CODE.NOT_FOUND, CATEGORY_NOT_FOUND);
  }

  const breadcrumb = await buildBreadcrumb((category._id as string).toString());
  return { category, breadcrumb };
};

// ─────────────────────────────────────────────────────────────
// Update — admin only
// ─────────────────────────────────────────────────────────────

const updateCategory = async (
  categoryId: string,
  payload: Partial<IJobCategory>,
) => {
  const category = await JobCategory.isCategoryExists(categoryId);
  if (!category) {
    throw new AppError(HTTP_STATUS_CODE.NOT_FOUND, CATEGORY_NOT_FOUND);
  }

  // If name is changing, check it isn't taken by another category
  if (payload.name && payload.name !== category.name) {
    const nameTaken = await JobCategory.isCategoryNameTaken(
      payload.name,
      categoryId,
    );
    if (nameTaken) {
      throw new AppError(HTTP_STATUS_CODE.CONFLICT, CATEGORY_ALREADY_EXISTS);
    }
  }

  const updated = await JobCategory.findByIdAndUpdate(
    categoryId,
    { $set: payload },
    { new: true, runValidators: true },
  );

  return updated;
};

// ─────────────────────────────────────────────────────────────
// Delete — admin only, soft delete
// Guards: no active children, no active jobs
// ─────────────────────────────────────────────────────────────

const deleteCategory = async (categoryId: string) => {
  const category = await JobCategory.isCategoryExists(categoryId);
  if (!category) {
    throw new AppError(HTTP_STATUS_CODE.NOT_FOUND, CATEGORY_NOT_FOUND);
  }

  // Prevent deleting a parent that still has children
  const childCount = await JobCategory.countDocuments({
    parentId: categoryId,
    isActive: true,
  });
  if (childCount > 0) {
    throw new AppError(HTTP_STATUS_CODE.BAD_REQUEST, CATEGORY_HAS_CHILDREN);
  }

  // Guard: cannot delete if jobs are actively using this category
  if (category.jobCount > 0) {
    throw new AppError(
      HTTP_STATUS_CODE.BAD_REQUEST,
      `Cannot delete category with ${category.jobCount} active job(s)`,
    );
  }

  await JobCategory.findByIdAndUpdate(categoryId, {
    $set: { isActive: false },
  });

  return { message: 'Category deleted successfully' };
};

// ─────────────────────────────────────────────────────────────
// Internal — called by jobListing service on publish/close
// ─────────────────────────────────────────────────────────────

const incrementJobCount = async (categoryId: string) => {
  await JobCategory.findByIdAndUpdate(categoryId, {
    $inc: { jobCount: 1 },
  });
};

const decrementJobCount = async (categoryId: string) => {
  await JobCategory.findByIdAndUpdate(
    // Prevent going below 0 — safety guard against race conditions
    { _id: categoryId, jobCount: { $gt: 0 } },
    { $inc: { jobCount: -1 } },
  );
};

export const jobCategoryService = {
  createCategory,
  getAllCategories,
  getCategoryTree,
  getRootCategories,
  getChildCategories,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
  incrementJobCount,
  decrementJobCount,
};