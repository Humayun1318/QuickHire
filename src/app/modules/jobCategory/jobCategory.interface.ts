

import { Document, Model, Types } from 'mongoose';

export interface IJobCategory {
  name:      string;
  slug:      string;          // auto-generated, URL-safe
  icon?:     string;          // icon class or URL for UI rendering
  // Self-reference — null means root/top-level category
  // parentId: null  → Technology, Design, Marketing
  // parentId: <id>  → Frontend (child of Technology)
  parentId?: Types.ObjectId | null;
  // Cached count — incremented when job is published, decremented on close/delete
  // Avoids expensive countDocuments() on every category list render
  jobCount:  number;
  isActive:  boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IJobCategoryDocument extends IJobCategory, Document {}

export interface IJobCategoryModel extends Model<IJobCategoryDocument> {
  // Check existence by id — used in job creation validation
  isCategoryExists(categoryId: string): Promise<IJobCategoryDocument | null>;
  // Check existence by name — used to prevent duplicates
  isCategoryNameTaken(name: string, excludeId?: string): Promise<boolean>;
}

// ─────────────────────────────────────────────────────────────
// Utility types for service layer
// ─────────────────────────────────────────────────────────────

// Recursive tree structure — used by buildCategoryTree utility
export interface ICategoryTreeNode extends IJobCategoryDocument {
  children: ICategoryTreeNode[];
}

// Breadcrumb item — used by buildBreadcrumb utility
export interface IBreadcrumbItem {
  _id:  string;
  name: string;
  slug: string;
}